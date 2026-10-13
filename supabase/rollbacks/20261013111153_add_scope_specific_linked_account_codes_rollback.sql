begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.linked_bank_accounts
  drop constraint if exists linked_bank_accounts_transfer_code_check;

alter table public.bank_transfers
  drop constraint if exists bank_transfers_recipient_code_check;

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
  v_recipient_address text;
  v_transfer_type public.bank_transfer_type_enum;
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
  join public.account_types as account_type
    on account_type.id = account.account_type_id
  where account.id = p_source_account_id and account.user_id = v_user_id;

  if not found then raise exception 'Source bank account was not found'; end if;
  if v_source_balance < p_amount then
    raise exception 'Insufficient bank account balance';
  end if;

  if v_destination_kind = 'own_account' then
    select account.currency_code, account.account_number, account_type.name
    into v_destination_currency_code, v_destination_account_number, v_destination_type
    from public.user_accounts as account
    join public.account_types as account_type
      on account_type.id = account.account_type_id
    where account.id = p_destination_id and account.user_id = v_user_id;

    if not found then raise exception 'Destination bank account was not found'; end if;
    if v_destination_currency_code <> v_source_currency_code then
      raise exception 'Bank accounts must use the same currency';
    end if;

    v_transfer_type := 'between_accounts'::public.bank_transfer_type_enum;
    v_recipient_name := v_destination_type || ' Account';
    v_recipient_bank_name := 'Global Stripe Fin';
    v_recipient_account_number := v_destination_account_number;
    v_recipient_routing_number := null;
    v_recipient_address := null;
  elsif v_destination_kind = 'linked_account' then
    select
      account.account_name,
      account.bank_name,
      account.account_number,
      account.routing_number,
      account.address,
      account.transfer_scope::text::public.bank_transfer_type_enum
    into
      v_recipient_name,
      v_recipient_bank_name,
      v_recipient_account_number,
      v_recipient_routing_number,
      v_recipient_address,
      v_transfer_type
    from public.linked_bank_accounts as account
    where account.id = p_destination_id and account.user_id = v_user_id;

    if not found then raise exception 'Linked bank account was not found'; end if;
    if v_transfer_type = 'international' and v_source_currency_code <> 'USD' then
      raise exception 'International transfers are available only from USD bank accounts';
    end if;
  else
    select
      beneficiary.account_name,
      beneficiary.bank_name,
      beneficiary.account_number,
      beneficiary.routing_number
    into
      v_recipient_name,
      v_recipient_bank_name,
      v_recipient_account_number,
      v_recipient_routing_number
    from public.bank_beneficiaries as beneficiary
    where beneficiary.id = p_destination_id and beneficiary.user_id = v_user_id;

    if not found then raise exception 'Beneficiary was not found'; end if;

    v_transfer_type := 'domestic'::public.bank_transfer_type_enum;
    v_recipient_address := null;
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
    user_id, source_account_id, transfer_type, destination_kind,
    destination_account_id, linked_bank_account_id, beneficiary_id,
    recipient_name, recipient_bank_name, recipient_account_number,
    recipient_routing_number, recipient_address,
    amount, currency_code, status
  ) values (
    v_user_id,
    p_source_account_id,
    v_transfer_type,
    v_destination_kind::public.bank_transfer_destination_enum,
    case when v_destination_kind = 'own_account' then p_destination_id end,
    case when v_destination_kind = 'linked_account' then p_destination_id end,
    case when v_destination_kind = 'beneficiary' then p_destination_id end,
    v_recipient_name,
    v_recipient_bank_name,
    v_recipient_account_number,
    v_recipient_routing_number,
    v_recipient_address,
    round(p_amount, 2),
    v_source_currency_code,
    v_status
  )
  returning * into v_transfer;

  return v_transfer;
end;
$$;

drop function if exists public.create_linked_account_and_submit_bank_transfer(
  uuid, text, numeric, text, text, text, text, text, text, text
);

create function public.create_linked_account_and_submit_bank_transfer(
  p_source_account_id uuid,
  p_transfer_type text,
  p_amount numeric,
  p_account_type text,
  p_account_name text,
  p_bank_name text,
  p_account_number text,
  p_routing_number text,
  p_address text
)
returns public.bank_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_transfer_type text := lower(btrim(coalesce(p_transfer_type, '')));
  v_linked_account_id uuid;
  v_transfer public.bank_transfers;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;
  if v_transfer_type not in ('domestic', 'international') then
    raise exception 'Choose Domestic or International transfer';
  end if;
  if lower(btrim(coalesce(p_account_type, ''))) not in ('personal', 'business') then
    raise exception 'Choose Personal or Business account';
  end if;
  if length(btrim(coalesce(p_account_name, ''))) not between 2 and 80 then
    raise exception 'Enter a valid account name';
  end if;
  if length(btrim(coalesce(p_bank_name, ''))) not between 2 and 120 then
    raise exception 'Enter a valid bank name';
  end if;
  if length(btrim(coalesce(p_account_number, ''))) not between 4 and 64 then
    raise exception 'Enter a valid account number';
  end if;
  if nullif(btrim(coalesce(p_routing_number, '')), '') is null then
    raise exception 'Enter a routing number';
  end if;
  if length(btrim(coalesce(p_address, ''))) not between 5 and 240 then
    raise exception 'Enter a valid address';
  end if;

  insert into public.linked_bank_accounts (
    user_id, account_type, account_name, bank_name, account_number,
    routing_number, address, transfer_scope
  ) values (
    v_user_id,
    lower(btrim(p_account_type)),
    btrim(p_account_name),
    btrim(p_bank_name),
    btrim(p_account_number),
    btrim(p_routing_number),
    btrim(p_address),
    v_transfer_type::public.linked_bank_account_scope_enum
  )
  on conflict (
    user_id,
    lower(btrim(bank_name)),
    btrim(account_number)
  ) do update
  set account_type = excluded.account_type,
      account_name = excluded.account_name,
      routing_number = excluded.routing_number,
      address = excluded.address,
      transfer_scope = excluded.transfer_scope
  returning id into v_linked_account_id;

  select transfer.* into v_transfer
  from public.submit_bank_transfer(
    p_source_account_id, 'linked_account', v_linked_account_id, p_amount
  ) as transfer;

  return v_transfer;
end;
$$;

revoke all on function public.create_linked_account_and_submit_bank_transfer(
  uuid, text, numeric, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_linked_account_and_submit_bank_transfer(
  uuid, text, numeric, text, text, text, text, text, text
) to authenticated, service_role;

-- The added columns are deliberately retained so rollback cannot destroy
-- SWIFT/BIC snapshots or linked-account data. Application code can ignore them.

commit;
