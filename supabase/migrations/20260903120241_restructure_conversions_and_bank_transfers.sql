begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

create temporary table migration_transfer_counts on commit drop as
select
  (select count(*) from public.currency_transfers) as conversion_history_count,
  (select count(*) from public.currency_withdrawals) as currency_transfer_history_count;

-- Preserve the previous RPCs under private-facing legacy names so the
-- companion rollback can restore their exact behavior without reconstructing
-- historical function bodies.
alter function public.transfer_currency_balance(text, numeric, text, text, uuid)
  rename to transfer_currency_balance_legacy;
alter function public.transfer_bank_account_to_usd_balance(uuid, numeric)
  rename to transfer_bank_account_to_usd_balance_legacy;
alter function public.request_currency_withdrawal(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) rename to request_currency_withdrawal_legacy;
alter function public.review_currency_withdrawal(uuid, text, text)
  rename to review_currency_withdrawal_legacy;

revoke all on function public.transfer_currency_balance_legacy(
  text, numeric, text, text, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.transfer_bank_account_to_usd_balance_legacy(uuid, numeric)
  from public, anon, authenticated, service_role;
revoke all on function public.request_currency_withdrawal_legacy(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.review_currency_withdrawal_legacy(uuid, text, text)
  from public, anon, authenticated, service_role;

drop trigger currency_withdrawals_review on public.currency_withdrawals;
alter function private.handle_currency_withdrawal_review()
  rename to handle_currency_withdrawal_review_legacy;

-- The old table contains five true conversions plus historical transfer
-- shapes. Rename it in place so no record is lost; only the new RPC is
-- permitted to append rows, and it writes currency-to-currency conversions.
alter table public.currency_transfers rename to currency_conversions;
alter table public.currency_conversions
  rename constraint currency_transfers_pkey to currency_conversions_pkey;
alter table public.currency_conversions
  rename constraint currency_transfers_user_id_fkey to currency_conversions_user_id_fkey;
alter table public.currency_conversions
  rename constraint currency_transfers_source_currency_code_fkey to currency_conversions_source_currency_code_fkey;
alter table public.currency_conversions
  rename constraint currency_transfers_destination_currency_code_fkey to currency_conversions_destination_currency_code_fkey;
alter table public.currency_conversions
  rename constraint currency_transfers_destination_account_id_fkey to currency_conversions_destination_account_id_fkey;
alter table public.currency_conversions
  rename constraint currency_transfers_source_account_id_fkey to currency_conversions_source_account_id_fkey;
alter table public.currency_conversions
  rename constraint currency_transfers_source_amount_positive to currency_conversions_source_amount_positive;
alter table public.currency_conversions
  rename constraint currency_transfers_destination_amount_positive to currency_conversions_destination_amount_positive;
alter table public.currency_conversions
  rename constraint currency_transfers_exchange_rate_positive to currency_conversions_exchange_rate_positive;
alter table public.currency_conversions
  rename constraint currency_transfers_status_check to currency_conversions_status_check;
alter table public.currency_conversions
  rename constraint currency_transfers_destination_check to currency_conversions_destination_check;

alter index public.currency_transfers_user_created_at_idx
  rename to currency_conversions_user_created_at_idx;
alter index public.currency_transfers_source_currency_code_idx
  rename to currency_conversions_source_currency_code_idx;
alter index public.currency_transfers_destination_currency_code_idx
  rename to currency_conversions_destination_currency_code_idx;
alter index public.currency_transfers_destination_account_id_idx
  rename to currency_conversions_destination_account_id_idx;
alter index public.currency_transfers_source_account_id_idx
  rename to currency_conversions_source_account_id_idx;
alter policy currency_transfers_owner_read on public.currency_conversions
  rename to currency_conversions_owner_read;

-- A currency transfer is the existing native-country payout workflow,
-- previously presented as a withdrawal.
alter table public.currency_withdrawals rename to currency_transfers;
alter table public.currency_transfers
  rename constraint currency_withdrawals_pkey to currency_transfers_pkey;
alter table public.currency_transfers
  rename constraint currency_withdrawals_user_id_fkey to currency_transfers_user_id_fkey;
alter table public.currency_transfers
  rename constraint currency_withdrawals_currency_code_fkey to currency_transfers_currency_code_fkey;
alter table public.currency_transfers
  rename constraint currency_withdrawals_amount_positive to currency_transfers_amount_positive;
alter index public.currency_withdrawals_user_created_at_idx
  rename to currency_transfers_user_created_at_idx;
alter index public.currency_withdrawals_pending_created_at_idx
  rename to currency_transfers_pending_created_at_idx;
alter index public.currency_withdrawals_currency_code_idx
  rename to currency_transfers_currency_code_idx;
alter policy currency_withdrawals_owner_read on public.currency_transfers
  rename to currency_transfers_owner_read;

create or replace function public.convert_currency_balance(
  p_source_currency_code text,
  p_amount numeric,
  p_destination_currency_code text
)
returns public.currency_conversions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_currency_code text := upper(btrim(p_source_currency_code));
  v_destination_currency_code text := upper(btrim(p_destination_currency_code));
  v_source_balance numeric(24, 6);
  v_source_usd_rate numeric(24, 12);
  v_destination_usd_rate numeric(24, 12);
  v_exchange_rate numeric(24, 12);
  v_destination_amount numeric(24, 6);
  v_locked_balance_count integer;
  v_conversion public.currency_conversions;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 6) then
    raise exception 'Enter a valid amount with no more than six decimal places';
  end if;

  if v_source_currency_code = v_destination_currency_code then
    raise exception 'Choose a different destination currency';
  end if;

  perform 1
  from public.user_currency_balances as balance
  where balance.user_id = v_user_id
    and balance.currency_code in (
      v_source_currency_code,
      v_destination_currency_code
    )
  order by balance.currency_code
  for update;

  get diagnostics v_locked_balance_count = row_count;
  if v_locked_balance_count <> 2 then
    raise exception 'Both currency balances must be enabled before converting';
  end if;

  select balance.balance
  into v_source_balance
  from public.user_currency_balances as balance
  where balance.user_id = v_user_id
    and balance.currency_code = v_source_currency_code;

  if v_source_balance < p_amount then
    raise exception 'Insufficient % balance', v_source_currency_code;
  end if;

  select
    max(rate.rate) filter (where rate.quote_currency_code = v_source_currency_code),
    max(rate.rate) filter (where rate.quote_currency_code = v_destination_currency_code)
  into v_source_usd_rate, v_destination_usd_rate
  from public.exchange_rates as rate
  where rate.base_currency_code = 'USD'
    and rate.quote_currency_code in (
      v_source_currency_code,
      v_destination_currency_code
    );

  if v_source_usd_rate is null or v_destination_usd_rate is null then
    raise exception 'An exchange rate is unavailable for this conversion';
  end if;

  v_exchange_rate := round(v_destination_usd_rate / v_source_usd_rate, 12);
  v_destination_amount := round(p_amount * v_exchange_rate, 6);

  if v_destination_amount <= 0 then
    raise exception 'The converted amount is too small';
  end if;

  update public.user_currency_balances
  set balance = case currency_code
    when v_source_currency_code then balance - p_amount
    when v_destination_currency_code then balance + v_destination_amount
  end
  where user_id = v_user_id
    and currency_code in (v_source_currency_code, v_destination_currency_code);

  insert into public.currency_conversions (
    user_id,
    source_currency_code,
    destination_type,
    destination_currency_code,
    destination_account_id,
    source_amount,
    exchange_rate,
    destination_amount,
    source_account_id
  )
  values (
    v_user_id,
    v_source_currency_code,
    'currency_balance',
    v_destination_currency_code,
    null,
    p_amount,
    v_exchange_rate,
    v_destination_amount,
    null
  )
  returning * into v_conversion;

  return v_conversion;
end;
$$;

create or replace function public.request_currency_transfer(
  p_currency_code text,
  p_amount numeric,
  p_account_holder_name text default null,
  p_bank_name text default null,
  p_bank_address text default null,
  p_beneficiary_address text default null,
  p_account_number text default null,
  p_account_type text default null,
  p_routing_number text default null,
  p_iban text default null,
  p_swift_bic text default null,
  p_sort_code text default null,
  p_bsb text default null,
  p_clabe text default null,
  p_wallet_address text default null,
  p_network text default null
)
returns public.currency_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency_code text := upper(btrim(p_currency_code));
  v_balance numeric(24, 6);
  v_transfer public.currency_transfers;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero';
  end if;
  if p_amount <> round(p_amount, 6) then
    raise exception 'Transfer amount cannot have more than six decimal places';
  end if;

  if v_currency_code in ('USD', 'EUR', 'AUD', 'AED', 'MXN', 'GBP', 'NZD')
    and (
      nullif(btrim(p_account_holder_name), '') is null
      or nullif(btrim(p_bank_name), '') is null
      or nullif(btrim(p_beneficiary_address), '') is null
    )
  then
    raise exception 'Account holder, bank name, and beneficiary address are required';
  end if;

  case v_currency_code
    when 'USD' then
      if nullif(btrim(p_account_number), '') is null
        or nullif(btrim(p_routing_number), '') is null
        or lower(btrim(p_account_type)) not in ('checking', 'savings')
      then raise exception 'USD transfers require an account number, routing number, and account type';
      end if;
    when 'EUR' then
      if nullif(btrim(p_iban), '') is null or nullif(btrim(p_swift_bic), '') is null
      then raise exception 'EUR transfers require an IBAN and SWIFT/BIC'; end if;
    when 'AUD' then
      if nullif(btrim(p_account_number), '') is null or nullif(btrim(p_bsb), '') is null
      then raise exception 'AUD transfers require an account number and BSB'; end if;
    when 'AED' then
      if nullif(btrim(p_iban), '') is null or nullif(btrim(p_swift_bic), '') is null
      then raise exception 'AED transfers require an IBAN and SWIFT/BIC'; end if;
    when 'MXN' then
      if nullif(btrim(p_clabe), '') is null
      then raise exception 'MXN transfers require a CLABE'; end if;
    when 'GBP' then
      if nullif(btrim(p_account_number), '') is null or nullif(btrim(p_sort_code), '') is null
      then raise exception 'GBP transfers require an account number and sort code'; end if;
    when 'NZD' then
      if nullif(btrim(p_account_number), '') is null
      then raise exception 'NZD transfers require a New Zealand account number'; end if;
    when 'USDC' then
      if nullif(btrim(p_wallet_address), '') is null or btrim(p_network) <> 'Ethereum (ERC20)'
      then raise exception 'USDC transfers require an Ethereum (ERC20) wallet'; end if;
    when 'USDT' then
      if nullif(btrim(p_wallet_address), '') is null or btrim(p_network) <> 'Tron (TRC20)'
      then raise exception 'USDT transfers require a Tron (TRC20) wallet'; end if;
    else raise exception 'This currency cannot be transferred';
  end case;

  select balance.balance into v_balance
  from public.user_currency_balances as balance
  where balance.user_id = v_user_id
    and balance.currency_code = v_currency_code
  for update;

  if not found then raise exception 'This currency balance is not enabled'; end if;
  if v_balance < p_amount then raise exception 'Insufficient % balance', v_currency_code; end if;

  update public.user_currency_balances
  set balance = balance - p_amount
  where user_id = v_user_id and currency_code = v_currency_code;

  insert into public.currency_transfers (
    user_id, currency_code, amount, account_holder_name, bank_name,
    bank_address, beneficiary_address, account_number, account_type,
    routing_number, iban, swift_bic, sort_code, bsb, clabe,
    wallet_address, network
  ) values (
    v_user_id, v_currency_code, p_amount,
    nullif(btrim(p_account_holder_name), ''),
    nullif(btrim(p_bank_name), ''),
    nullif(btrim(p_bank_address), ''),
    nullif(btrim(p_beneficiary_address), ''),
    nullif(btrim(p_account_number), ''),
    nullif(lower(btrim(p_account_type)), ''),
    nullif(btrim(p_routing_number), ''),
    nullif(upper(btrim(p_iban)), ''),
    nullif(upper(btrim(p_swift_bic)), ''),
    nullif(btrim(p_sort_code), ''),
    nullif(btrim(p_bsb), ''),
    nullif(btrim(p_clabe), ''),
    nullif(btrim(p_wallet_address), ''),
    nullif(btrim(p_network), '')
  ) returning * into v_transfer;

  return v_transfer;
end;
$$;

create or replace function private.handle_currency_transfer_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance_update_count integer;
begin
  if new.user_id is distinct from old.user_id
    or new.currency_code is distinct from old.currency_code
    or new.amount is distinct from old.amount
  then
    raise exception 'A transfer owner, currency, and amount cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'pending' then
      raise exception 'A reviewed transfer cannot return to pending';
    end if;
    if new.status = 'rejected' and old.status <> 'rejected' then
      update public.user_currency_balances
      set balance = balance + new.amount
      where user_id = new.user_id and currency_code = new.currency_code;
      if not found then raise exception 'The reserved currency balance could not be refunded'; end if;
    elsif new.status = 'approved' and old.status = 'rejected' then
      update public.user_currency_balances
      set balance = balance - new.amount
      where user_id = new.user_id
        and currency_code = new.currency_code
        and balance >= new.amount;
      get diagnostics v_balance_update_count = row_count;
      if v_balance_update_count <> 1 then
        raise exception 'The transfer cannot be approved because the refunded balance is insufficient';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create trigger currency_transfers_review
before update on public.currency_transfers
for each row execute function private.handle_currency_transfer_review();

create or replace function public.review_currency_transfer(
  p_transfer_id uuid,
  p_status text,
  p_review_note text default null
)
returns public.currency_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := lower(btrim(p_status));
  v_transfer public.currency_transfers;
begin
  if v_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected';
  end if;
  select transfer.* into v_transfer
  from public.currency_transfers as transfer
  where transfer.id = p_transfer_id
  for update;
  if not found then raise exception 'Currency transfer was not found'; end if;
  if v_transfer.status <> 'pending' then
    raise exception 'Only pending currency transfers can be reviewed';
  end if;
  update public.currency_transfers
  set status = v_status::public.request_status,
      review_note = nullif(btrim(p_review_note), '')
  where id = p_transfer_id
  returning * into v_transfer;
  return v_transfer;
end;
$$;

revoke all on function public.convert_currency_balance(text, numeric, text)
  from public, anon;
grant execute on function public.convert_currency_balance(text, numeric, text)
  to authenticated, service_role;
revoke all on function public.request_currency_transfer(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.request_currency_transfer(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) to authenticated, service_role;
revoke all on function public.review_currency_transfer(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_currency_transfer(uuid, text, text)
  to service_role;
revoke all on function private.handle_currency_transfer_review()
  from public, anon, authenticated, service_role;

create type public.bank_transfer_destination_enum as enum (
  'own_account',
  'linked_account',
  'beneficiary'
);
create type public.bank_transfer_status_enum as enum (
  'pending',
  'completed',
  'rejected'
);

create table public.bank_beneficiaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_type text not null,
  account_name text not null,
  bank_name text not null,
  account_number text not null,
  routing_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_beneficiaries_account_type_check
    check (account_type in ('personal', 'business')),
  constraint bank_beneficiaries_account_name_check
    check (length(btrim(account_name)) between 2 and 80),
  constraint bank_beneficiaries_bank_name_check
    check (length(btrim(bank_name)) between 2 and 120),
  constraint bank_beneficiaries_account_number_check
    check (length(btrim(account_number)) between 4 and 64),
  constraint bank_beneficiaries_user_account_number_key
    unique (user_id, account_number)
);

create index bank_beneficiaries_user_created_at_idx
  on public.bank_beneficiaries(user_id, created_at desc);
create trigger bank_beneficiaries_set_updated_at
before update on public.bank_beneficiaries
for each row execute function private.set_updated_at();

alter table public.bank_beneficiaries enable row level security;
create policy bank_beneficiaries_owner_select
on public.bank_beneficiaries for select to authenticated
using ((select auth.uid()) = user_id and (select public.is_current_session_verified()));
create policy bank_beneficiaries_owner_insert
on public.bank_beneficiaries for insert to authenticated
with check ((select auth.uid()) = user_id and (select public.is_current_session_verified()));
create policy bank_beneficiaries_owner_update
on public.bank_beneficiaries for update to authenticated
using ((select auth.uid()) = user_id and (select public.is_current_session_verified()))
with check ((select auth.uid()) = user_id and (select public.is_current_session_verified()));
create policy bank_beneficiaries_owner_delete
on public.bank_beneficiaries for delete to authenticated
using ((select auth.uid()) = user_id and (select public.is_current_session_verified()));

revoke all on table public.bank_beneficiaries from public, anon, authenticated;
grant select, insert, update, delete on table public.bank_beneficiaries to authenticated;
grant all on table public.bank_beneficiaries to service_role;

create table public.bank_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_account_id uuid not null references public.user_accounts(id) on delete cascade,
  destination_kind public.bank_transfer_destination_enum not null,
  destination_account_id uuid references public.user_accounts(id) on delete restrict,
  linked_bank_account_id uuid references public.linked_bank_accounts(id) on delete set null,
  beneficiary_id uuid references public.bank_beneficiaries(id) on delete set null,
  recipient_name text not null,
  recipient_bank_name text not null,
  recipient_account_number text not null,
  recipient_routing_number text,
  amount numeric(20, 2) not null,
  currency_code text not null references public.currencies(code),
  status public.bank_transfer_status_enum not null,
  review_note text,
  application_reference text not null default (
    'GSF-TR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
  ),
  created_at timestamptz not null default now(),
  constraint bank_transfers_amount_positive check (amount > 0),
  constraint bank_transfers_application_reference_key unique (application_reference),
  constraint bank_transfers_destination_check check (
    (destination_kind = 'own_account' and destination_account_id is not null
      and linked_bank_account_id is null and beneficiary_id is null)
    or
    (destination_kind = 'linked_account' and destination_account_id is null
      and linked_bank_account_id is not null and beneficiary_id is null)
    or
    (destination_kind = 'beneficiary' and destination_account_id is null
      and linked_bank_account_id is null and beneficiary_id is not null)
  )
);

create index bank_transfers_user_created_at_idx
  on public.bank_transfers(user_id, created_at desc);
create index bank_transfers_source_account_id_idx
  on public.bank_transfers(source_account_id);
create index bank_transfers_pending_created_at_idx
  on public.bank_transfers(created_at) where status = 'pending';

alter table public.bank_transfers enable row level security;
create policy bank_transfers_owner_read
on public.bank_transfers for select to authenticated
using ((select auth.uid()) = user_id and (select public.is_current_session_verified()));
revoke all on table public.bank_transfers from public, anon, authenticated;
grant select on table public.bank_transfers to authenticated;
grant all on table public.bank_transfers to service_role;

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
  then raise exception 'Reviewed transfer details cannot be changed'; end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' or new.status not in ('completed', 'rejected') then
      raise exception 'Invalid bank transfer status transition';
    end if;
    if new.status = 'rejected' then
      update public.user_accounts
      set balance = balance + new.amount
      where id = new.source_account_id and user_id = new.user_id;
      if not found then raise exception 'The reserved source balance could not be refunded'; end if;
    elsif new.destination_kind = 'own_account' then
      update public.user_accounts
      set balance = balance + new.amount
      where id = new.destination_account_id
        and user_id = new.user_id
        and currency_code = new.currency_code;
      if not found then raise exception 'Destination account was not found'; end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.notify_bank_transfer_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id, type, title, message)
    values (
      new.user_id,
      'transaction',
      case when new.status = 'pending' then 'Escrow transfer submitted' else 'Transfer complete' end,
      case when new.status = 'pending'
        then format('%s is pending approval.', new.application_reference)
        else format('%s was completed.', new.application_reference)
      end
    );
  elsif new.status is distinct from old.status then
    insert into public.notifications(user_id, type, title, message)
    values (
      new.user_id,
      'transaction',
      case new.status when 'completed' then 'Escrow transfer approved' else 'Escrow transfer rejected' end,
      format('%s was %s.', new.application_reference, new.status::text)
    );
  end if;
  return new;
end;
$$;

create trigger bank_transfers_review
before update on public.bank_transfers
for each row execute function private.handle_bank_transfer_review();
create trigger bank_transfers_notify
after insert or update of status on public.bank_transfers
for each row execute function private.notify_bank_transfer_status();

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
  v_destination_kind text := lower(btrim(p_destination_kind));
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
      case when v_destination_kind = 'own_account' then p_destination_id else p_source_account_id end
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
    into v_recipient_name, v_recipient_bank_name, v_recipient_account_number, v_recipient_routing_number
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

create or replace function public.review_bank_transfer(
  p_transfer_id uuid,
  p_status text,
  p_review_note text default null
)
returns public.bank_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := lower(btrim(p_status));
  v_transfer public.bank_transfers;
begin
  if v_status not in ('completed', 'rejected') then
    raise exception 'Review status must be completed or rejected';
  end if;
  select transfer.* into v_transfer
  from public.bank_transfers as transfer
  where transfer.id = p_transfer_id
  for update;
  if not found then raise exception 'Bank transfer was not found'; end if;
  if v_transfer.status <> 'pending' then
    raise exception 'Only pending escrow transfers can be reviewed';
  end if;
  update public.bank_transfers
  set status = v_status::public.bank_transfer_status_enum,
      review_note = nullif(btrim(p_review_note), '')
  where id = p_transfer_id
  returning * into v_transfer;
  return v_transfer;
end;
$$;

revoke all on function public.submit_bank_transfer(uuid, text, uuid, numeric)
  from public, anon;
grant execute on function public.submit_bank_transfer(uuid, text, uuid, numeric)
  to authenticated, service_role;
revoke all on function public.review_bank_transfer(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_bank_transfer(uuid, text, text)
  to service_role;
revoke all on function private.handle_bank_transfer_review()
  from public, anon, authenticated, service_role;
revoke all on function private.notify_bank_transfer_status()
  from public, anon, authenticated, service_role;

comment on table public.currency_conversions is
  'Currency-to-currency conversions. Historical non-conversion rows are retained for audit continuity.';
comment on table public.currency_transfers is
  'Pending and reviewed transfers from currency balances to native bank or supported wallet destinations.';
comment on table public.bank_transfers is
  'Bank-account transfers. Escrow-involved transfers reserve funds until approved or rejected.';

do $$
begin
  if (select count(*) from public.currency_conversions) <>
    (select conversion_history_count from migration_transfer_counts)
  then
    raise exception 'Currency conversion history count changed during rename';
  end if;
  if (select count(*) from public.currency_transfers) <>
    (select currency_transfer_history_count from migration_transfer_counts)
  then
    raise exception 'Currency transfer history count changed during rename';
  end if;
end;
$$;

commit;
