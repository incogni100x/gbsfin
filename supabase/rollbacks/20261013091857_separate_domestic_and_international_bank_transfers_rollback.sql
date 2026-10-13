begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table if not exists private.bank_transfer_type_rollback_archive (
  transfer_id uuid primary key,
  transfer_type text not null,
  recipient_address text,
  archived_at timestamptz not null default now()
);

create table if not exists private.linked_bank_account_scope_rollback_archive (
  linked_bank_account_id uuid primary key,
  transfer_scope text not null,
  address text,
  archived_at timestamptz not null default now()
);

alter table private.bank_transfer_type_rollback_archive enable row level security;
alter table private.linked_bank_account_scope_rollback_archive enable row level security;
revoke all on table private.bank_transfer_type_rollback_archive
  from public, anon, authenticated;
revoke all on table private.linked_bank_account_scope_rollback_archive
  from public, anon, authenticated;

insert into private.bank_transfer_type_rollback_archive (
  transfer_id,
  transfer_type,
  recipient_address
)
select id, transfer_type::text, recipient_address
from public.bank_transfers
on conflict (transfer_id) do update
set transfer_type = excluded.transfer_type,
    recipient_address = excluded.recipient_address,
    archived_at = now();

insert into private.linked_bank_account_scope_rollback_archive (
  linked_bank_account_id,
  transfer_scope,
  address
)
select id, transfer_scope::text, address
from public.linked_bank_accounts
on conflict (linked_bank_account_id) do update
set transfer_scope = excluded.transfer_scope,
    address = excluded.address,
    archived_at = now();

drop function if exists public.create_linked_account_and_submit_bank_transfer(
  uuid, text, numeric, text, text, text, text, text, text
);

drop index if exists public.bank_transfers_user_type_created_at_idx;
drop index if exists public.linked_bank_accounts_user_scope_created_at_idx;

alter table public.bank_transfers
  drop constraint if exists bank_transfers_transfer_type_destination_check,
  drop column if exists recipient_address,
  drop column if exists transfer_type;

alter table public.linked_bank_accounts
  drop constraint if exists linked_bank_accounts_address_check,
  drop column if exists address,
  drop column if exists transfer_scope;

drop type if exists public.linked_bank_account_scope_enum;
drop type if exists public.bank_transfer_type_enum;

create or replace function private.handle_bank_transfer_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.source_account_id is distinct from old.source_account_id
    or new.destination_kind is distinct from old.destination_kind
    or new.destination_account_id is distinct from old.destination_account_id
    or new.linked_bank_account_id is distinct from old.linked_bank_account_id
    or new.beneficiary_id is distinct from old.beneficiary_id
    or new.amount is distinct from old.amount
    or new.currency_code is distinct from old.currency_code
    or new.application_reference is distinct from old.application_reference
  then
    raise exception 'Reviewed transfer details cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' or new.status not in ('completed', 'rejected') then
      raise exception 'Invalid bank transfer status transition';
    end if;
    if new.status = 'rejected' then
      update public.user_accounts
      set balance = balance + new.amount
      where id = new.source_account_id and user_id = new.user_id;
      if not found then
        raise exception 'The reserved source balance could not be refunded';
      end if;
    elsif new.destination_kind = 'own_account' then
      update public.user_accounts
      set balance = balance + new.amount
      where id = new.destination_account_id
        and user_id = new.user_id
        and currency_code = new.currency_code;
      if not found then
        raise exception 'Destination account was not found';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.submit_bank_transfer(
  p_source_account_id uuid,
  p_destination_kind text,
  p_destination_id uuid,
  p_amount numeric
)
returns public.bank_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_destination_kind text := lower(btrim(coalesce(p_destination_kind, '')));
  v_source_balance numeric(20, 2);
  v_source_currency_code text;
  v_source_type text;
  v_destination_currency_code text;
  v_destination_account_number text;
  v_destination_type text;
  v_recipient_name text;
  v_recipient_bank_name text;
  v_recipient_account_number text;
  v_recipient_routing_number text;
  v_status public.bank_transfer_status_enum;
  v_transfer public.bank_transfers;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a valid amount with no more than two decimal places';
  end if;
  if v_destination_kind not in ('own_account', 'linked_account', 'beneficiary') then
    raise exception 'Choose a valid transfer destination';
  end if;
  if p_destination_id is null then raise exception 'Choose a recipient'; end if;
  if v_destination_kind = 'own_account' and p_destination_id = p_source_account_id then
    raise exception 'Choose a different destination account';
  end if;

  perform 1
  from public.user_accounts as account
  where account.user_id = v_user_id
    and account.id in (
      p_source_account_id,
      case when v_destination_kind = 'own_account'
        then p_destination_id else p_source_account_id end
    )
  order by account.id
  for update;

  select account.balance, account.currency_code, account_type.name
  into v_source_balance, v_source_currency_code, v_source_type
  from public.user_accounts as account
  join public.account_types as account_type on account_type.id = account.account_type_id
  where account.id = p_source_account_id and account.user_id = v_user_id;
  if not found then raise exception 'Source bank account was not found'; end if;
  if v_source_balance < p_amount then raise exception 'Insufficient bank account balance'; end if;

  if v_destination_kind = 'own_account' then
    select account.currency_code, account.account_number, account_type.name
    into v_destination_currency_code, v_destination_account_number, v_destination_type
    from public.user_accounts as account
    join public.account_types as account_type on account_type.id = account.account_type_id
    where account.id = p_destination_id and account.user_id = v_user_id;
    if not found then raise exception 'Destination bank account was not found'; end if;
    if v_destination_currency_code <> v_source_currency_code then
      raise exception 'Bank accounts must use the same currency';
    end if;
    v_recipient_name := v_destination_type || ' Account';
    v_recipient_bank_name := 'Global Stripe Fin';
    v_recipient_account_number := v_destination_account_number;
    v_recipient_routing_number := null;
  elsif v_destination_kind = 'linked_account' then
    select account.account_name, account.bank_name, account.account_number, account.routing_number
    into v_recipient_name, v_recipient_bank_name,
         v_recipient_account_number, v_recipient_routing_number
    from public.linked_bank_accounts as account
    where account.id = p_destination_id and account.user_id = v_user_id;
    if not found then raise exception 'Linked bank account was not found'; end if;
  else
    select beneficiary.account_name, beneficiary.bank_name,
           beneficiary.account_number, beneficiary.routing_number
    into v_recipient_name, v_recipient_bank_name,
         v_recipient_account_number, v_recipient_routing_number
    from public.bank_beneficiaries as beneficiary
    where beneficiary.id = p_destination_id and beneficiary.user_id = v_user_id;
    if not found then raise exception 'Beneficiary was not found'; end if;
  end if;

  v_status := case
    when lower(v_source_type) = 'escrow'
      or lower(coalesce(v_destination_type, '')) = 'escrow'
    then 'pending'::public.bank_transfer_status_enum
    else 'completed'::public.bank_transfer_status_enum
  end;

  update public.user_accounts
  set balance = balance - p_amount
  where id = p_source_account_id and user_id = v_user_id;

  if v_status = 'completed' and v_destination_kind = 'own_account' then
    update public.user_accounts
    set balance = balance + p_amount
    where id = p_destination_id and user_id = v_user_id;
  end if;

  insert into public.bank_transfers (
    user_id, source_account_id, destination_kind, destination_account_id,
    linked_bank_account_id, beneficiary_id, recipient_name,
    recipient_bank_name, recipient_account_number, recipient_routing_number,
    amount, currency_code, status
  ) values (
    v_user_id,
    p_source_account_id,
    v_destination_kind::public.bank_transfer_destination_enum,
    case when v_destination_kind = 'own_account' then p_destination_id end,
    case when v_destination_kind = 'linked_account' then p_destination_id end,
    case when v_destination_kind = 'beneficiary' then p_destination_id end,
    v_recipient_name,
    v_recipient_bank_name,
    v_recipient_account_number,
    v_recipient_routing_number,
    round(p_amount, 2),
    v_source_currency_code,
    v_status
  ) returning * into v_transfer;

  return v_transfer;
end;
$$;

commit;
