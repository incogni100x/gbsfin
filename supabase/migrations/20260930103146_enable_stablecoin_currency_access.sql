begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- Safety checkpoint: the catalog, USD rates, and wallet instructions must be
-- complete before stablecoin access can be exposed through the currency flow.
do $$
begin
  if (
    select count(*)
    from public.currencies
    where code in ('USDC', 'USDT')
      and currency_kind = 'stablecoin'
      and is_active
  ) <> 2 then
    raise exception 'Stablecoin migration stopped: USDC and USDT must both be active';
  end if;

  if (
    select count(*)
    from public.exchange_rates
    where base_currency_code = 'USD'
      and quote_currency_code in ('USDC', 'USDT')
      and rate > 0
  ) <> 2 then
    raise exception 'Stablecoin migration stopped: USD rates are incomplete';
  end if;

  if (
    select count(*)
    from public.deposit_instructions
    where currency_code in ('USDC', 'USDT')
      and is_active
      and wallet_address is not null
      and network is not null
  ) <> 2 then
    raise exception 'Stablecoin migration stopped: wallet instructions are incomplete';
  end if;
end;
$$;

-- These private snapshots are retained for the companion rollback and for a
-- post-deploy balance audit. No financial row is deleted or zeroed.
create table private.stablecoin_access_balance_archive_20260930 (
  user_id uuid not null,
  currency_code text not null,
  balance numeric(24, 6) not null,
  enabled_at timestamptz not null,
  updated_at timestamptz not null,
  archived_at timestamptz not null default now(),
  primary key (user_id, currency_code),
  constraint stablecoin_access_balance_archive_currency_check
    check (currency_code in ('USDC', 'USDT'))
);

create table private.stablecoin_access_request_archive_20260930 (
  id uuid primary key,
  user_id uuid not null,
  currency_code text not null,
  status public.request_status not null,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  application_reference text not null,
  archived_at timestamptz not null default now(),
  constraint stablecoin_access_request_archive_currency_check
    check (currency_code in ('USDC', 'USDT'))
);

revoke all on table private.stablecoin_access_balance_archive_20260930
  from public, anon, authenticated;
revoke all on table private.stablecoin_access_request_archive_20260930
  from public, anon, authenticated;

insert into private.stablecoin_access_balance_archive_20260930 (
  user_id,
  currency_code,
  balance,
  enabled_at,
  updated_at
)
select user_id, currency_code, balance, enabled_at, updated_at
from public.user_currency_balances
where currency_code in ('USDC', 'USDT');

insert into private.stablecoin_access_request_archive_20260930 (
  id,
  user_id,
  currency_code,
  status,
  review_note,
  reviewed_at,
  created_at,
  updated_at,
  application_reference
)
select
  id,
  user_id,
  currency_code,
  status,
  review_note,
  reviewed_at,
  created_at,
  updated_at,
  application_reference
from public.currency_access_requests
where currency_code in ('USDC', 'USDT');

alter table public.user_currency_balances
  add column is_enabled boolean not null default true;

comment on column public.user_currency_balances.is_enabled is
  'Revocable access switch. Disabled rows retain their balance and history but cannot be read or mutated by the user.';

-- Existing stablecoin rows are frozen in place so every user must apply and
-- be approved before they can see or use the balance again.
update public.user_currency_balances
set is_enabled = false
where currency_code in ('USDC', 'USDT');

update public.currency_access_requests
set
  status = 'rejected',
  review_note = 'Stablecoin access was reset. Submit a new application to restore access.',
  reviewed_at = now()
where currency_code in ('USDC', 'USDT');

-- Preserve the exact pre-migration RPC and trigger functions for rollback.
alter function public.request_currency_access(text)
  rename to request_currency_access_before_stablecoin_access;
revoke all on function public.request_currency_access_before_stablecoin_access(text)
  from public, anon, authenticated, service_role;

drop trigger currency_access_requests_review
  on public.currency_access_requests;
alter function private.handle_currency_request_review()
  rename to handle_currency_request_review_before_stablecoin_access;

create function private.handle_currency_request_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'pending' then
      new.reviewed_at = null;
      new.review_note = null;
    else
      new.reviewed_at = now();
    end if;
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.user_currency_balances (
      user_id,
      currency_code,
      is_enabled,
      enabled_at
    )
    values (new.user_id, new.currency_code, true, now())
    on conflict (user_id, currency_code) do update
    set
      is_enabled = true,
      enabled_at = now();
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    update public.user_currency_balances
    set is_enabled = false
    where user_id = new.user_id
      and currency_code = new.currency_code;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_currency_request_review()
  from public, anon, authenticated, service_role;

create trigger currency_access_requests_review
before update on public.currency_access_requests
for each row execute function private.handle_currency_request_review();

drop policy currency_access_requests_owner_insert
  on public.currency_access_requests;
drop policy currency_access_requests_owner_reapply
  on public.currency_access_requests;

create policy currency_access_requests_owner_insert
on public.currency_access_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and review_note is null
  and reviewed_at is null
  and currency_code <> 'USD'
  and exists (
    select 1
    from public.currencies as currency
    where currency.code = currency_access_requests.currency_code
      and currency.is_active
  )
  and (select public.is_current_session_verified())
);

create policy currency_access_requests_owner_reapply
on public.currency_access_requests
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and status = 'rejected'
  and currency_code <> 'USD'
  and (select public.is_current_session_verified())
)
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and currency_code <> 'USD'
  and review_note is null
  and reviewed_at is null
  and (select public.is_current_session_verified())
);

create function public.request_currency_access(p_currency_code text)
returns public.currency_access_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency_code text := upper(btrim(p_currency_code));
  v_request public.currency_access_requests;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if v_currency_code = 'USD' or not exists (
    select 1
    from public.currencies as currency
    where currency.code = v_currency_code
      and currency.is_active
  ) then
    raise exception 'This currency cannot be requested';
  end if;

  select request.*
  into v_request
  from public.currency_access_requests as request
  where request.user_id = v_user_id
    and request.currency_code = v_currency_code;

  if found then
    if v_request.status = 'rejected' then
      update public.currency_access_requests
      set status = 'pending'
      where id = v_request.id
      returning * into v_request;
    end if;

    return v_request;
  end if;

  insert into public.currency_access_requests (user_id, currency_code)
  values (v_user_id, v_currency_code)
  returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.request_currency_access(text)
  from public, anon;
grant execute on function public.request_currency_access(text)
  to authenticated;

drop policy user_currency_balances_owner_read
  on public.user_currency_balances;
create policy user_currency_balances_owner_read
on public.user_currency_balances
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and is_enabled
  and (select public.is_current_session_verified())
);

drop policy deposit_instructions_approved_currency_read
  on public.deposit_instructions;
create policy deposit_instructions_approved_currency_read
on public.deposit_instructions
for select
to authenticated
using (
  is_active
  and exists (
    select 1
    from public.user_currency_balances as balance
    where balance.user_id = (select auth.uid())
      and balance.currency_code = deposit_instructions.currency_code
      and balance.is_enabled
  )
  and (select public.is_current_session_verified())
);

-- New stablecoin deposits now fund the matching currency balance. Historical
-- account-deposit rows remain untouched and keep their original audit meaning.
alter table public.currency_deposits
  drop constraint currency_deposits_fiat_only_check;

drop policy currency_deposits_owner_insert
  on public.currency_deposits;
create policy currency_deposits_owner_insert
on public.currency_deposits
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and review_note is null
  and currency_code <> 'USD'
  and exists (
    select 1
    from public.currencies as currency
    where currency.code = currency_deposits.currency_code
      and currency.is_active
  )
  and exists (
    select 1
    from public.user_currency_balances as balance
    where balance.user_id = (select auth.uid())
      and balance.currency_code = currency_deposits.currency_code
      and balance.is_enabled
  )
  and (select public.is_current_session_verified())
);

drop trigger currency_deposits_review on public.currency_deposits;
alter function private.handle_currency_deposit_review()
  rename to handle_currency_deposit_review_before_stablecoin_access;

create function private.handle_currency_deposit_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'approved' and (
    new.status is distinct from old.status
    or new.user_id is distinct from old.user_id
    or new.currency_code is distinct from old.currency_code
    or new.instruction_id is distinct from old.instruction_id
    or new.amount is distinct from old.amount
    or new.sender_name is distinct from old.sender_name
    or new.sender_reference is distinct from old.sender_reference
  ) then
    raise exception 'An approved deposit cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
      raise exception 'Invalid deposit status transition from % to %', old.status, new.status;
    end if;

    if new.status = 'approved' then
      update public.user_currency_balances
      set balance = balance + new.amount
      where user_id = new.user_id
        and currency_code = new.currency_code
        and is_enabled;

      if not found then
        raise exception 'Currency balance is not enabled for this user';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_currency_deposit_review()
  from public, anon, authenticated, service_role;

create trigger currency_deposits_review
before update on public.currency_deposits
for each row execute function private.handle_currency_deposit_review();

-- Disable only the obsolete write path. Existing stablecoin account-deposit
-- rows stay readable and reviewable as historical requests.
revoke execute on function public.submit_stablecoin_deposit_request(
  uuid, text, uuid, numeric, text
) from authenticated;

drop policy account_deposit_requests_owner_insert
  on public.account_deposit_requests;
create policy account_deposit_requests_owner_insert
on public.account_deposit_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and review_note is null
  and method in ('wire_ach', 'direct_deposit', 'cheque')
  and exists (
    select 1
    from public.user_accounts as account
    where account.id = account_deposit_requests.account_id
      and account.user_id = (select auth.uid())
      and account.currency_code = account_deposit_requests.currency_code
  )
  and (
    (
      method = 'wire_ach'
      and exists (
        select 1
        from public.linked_bank_accounts as linked_account
        where linked_account.id = account_deposit_requests.linked_bank_account_id
          and linked_account.user_id = (select auth.uid())
      )
    )
    or method = 'direct_deposit'
    or (
      method = 'cheque'
      and cheque_file_path like (select auth.uid())::text || '/%'
    )
  )
  and (select public.is_current_session_verified())
);

-- Expand both conversion directions to all active, approved non-USD
-- currencies while preserving the current ledger shape.
alter function public.convert_currency_balance(text, numeric, text, text, uuid)
  rename to convert_currency_balance_before_stablecoin_access;
revoke all on function public.convert_currency_balance_before_stablecoin_access(
  text, numeric, text, text, uuid
) from public, anon, authenticated, service_role;

create function public.convert_currency_balance(
  p_source_currency_code text,
  p_amount numeric,
  p_destination_type text,
  p_destination_currency_code text default null,
  p_destination_account_id uuid default null
)
returns public.currency_conversions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_currency_code text := upper(btrim(p_source_currency_code));
  v_destination_type text := lower(btrim(p_destination_type));
  v_destination_currency_code text := upper(nullif(btrim(p_destination_currency_code), ''));
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
  if v_destination_type not in ('currency_balance', 'bank_account') then
    raise exception 'Choose a valid conversion destination';
  end if;
  if not exists (
    select 1 from public.currencies as currency
    where currency.code = v_source_currency_code
      and currency.is_active
      and currency.code <> 'USD'
  ) then
    raise exception 'The selected source currency is unavailable';
  end if;

  if v_destination_type = 'currency_balance' then
    if v_destination_currency_code is null
      or v_destination_currency_code = v_source_currency_code
    then
      raise exception 'Choose a different destination currency';
    end if;
    if not exists (
      select 1 from public.currencies as currency
      where currency.code = v_destination_currency_code
        and currency.is_active
        and currency.code <> 'USD'
    ) then
      raise exception 'The selected destination currency is unavailable';
    end if;
    if p_destination_account_id is not null then
      raise exception 'A currency conversion cannot include a bank account';
    end if;

    perform 1
    from public.user_currency_balances as balance
    where balance.user_id = v_user_id
      and balance.currency_code in (
        v_source_currency_code,
        v_destination_currency_code
      )
      and balance.is_enabled
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
      and balance.currency_code = v_source_currency_code
      and balance.is_enabled;

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
      and currency_code in (
        v_source_currency_code,
        v_destination_currency_code
      )
      and is_enabled;
  else
    if p_destination_account_id is null then
      raise exception 'Choose your Checking account';
    end if;
    if v_destination_currency_code is not null
      and v_destination_currency_code <> 'USD'
    then
      raise exception 'Currency balances can only convert into Checking';
    end if;

    select balance.balance
    into v_source_balance
    from public.user_currency_balances as balance
    where balance.user_id = v_user_id
      and balance.currency_code = v_source_currency_code
      and balance.is_enabled
    for update;

    if not found then
      raise exception 'The source currency balance is not enabled';
    end if;
    if v_source_balance < p_amount then
      raise exception 'Insufficient % balance', v_source_currency_code;
    end if;

    perform 1
    from public.user_accounts as account
    join public.account_types as account_type
      on account_type.id = account.account_type_id
    where account.id = p_destination_account_id
      and account.user_id = v_user_id
      and account.currency_code = 'USD'
      and account_type.name = 'Checking'
      and account_type.is_active
    for update of account;

    if not found then
      raise exception 'Choose your valid Checking account';
    end if;

    select rate.rate
    into v_source_usd_rate
    from public.exchange_rates as rate
    where rate.base_currency_code = 'USD'
      and rate.quote_currency_code = v_source_currency_code;

    if v_source_usd_rate is null then
      raise exception 'An exchange rate is unavailable for this conversion';
    end if;

    v_destination_currency_code := 'USD';
    v_exchange_rate := round(1 / v_source_usd_rate, 12);
    v_destination_amount := round(p_amount * v_exchange_rate, 2);
    if v_destination_amount <= 0 then
      raise exception 'The converted amount is too small';
    end if;

    update public.user_currency_balances
    set balance = balance - p_amount
    where user_id = v_user_id
      and currency_code = v_source_currency_code
      and is_enabled;

    update public.user_accounts
    set balance = balance + v_destination_amount
    where id = p_destination_account_id
      and user_id = v_user_id;
  end if;

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
  ) values (
    v_user_id,
    v_source_currency_code,
    v_destination_type,
    v_destination_currency_code,
    case when v_destination_type = 'bank_account'
      then p_destination_account_id else null end,
    p_amount,
    v_exchange_rate,
    v_destination_amount,
    null
  ) returning * into v_conversion;

  return v_conversion;
end;
$$;

revoke all on function public.convert_currency_balance(
  text, numeric, text, text, uuid
) from public, anon;
grant execute on function public.convert_currency_balance(
  text, numeric, text, text, uuid
) to authenticated, service_role;

alter function public.convert_checking_account_balance(uuid, numeric, text)
  rename to convert_checking_account_balance_before_stablecoin_access;
revoke all on function public.convert_checking_account_balance_before_stablecoin_access(
  uuid, numeric, text
) from public, anon, authenticated, service_role;

create function public.convert_checking_account_balance(
  p_source_account_id uuid,
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
  v_destination_currency_code text := upper(btrim(p_destination_currency_code));
  v_source_balance numeric(20, 2);
  v_exchange_rate numeric(24, 12);
  v_destination_amount numeric(24, 6);
  v_conversion public.currency_conversions;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a valid amount with no more than two decimal places';
  end if;
  if not exists (
    select 1 from public.currencies as currency
    where currency.code = v_destination_currency_code
      and currency.is_active
      and currency.code <> 'USD'
  ) then
    raise exception 'Choose an available destination currency';
  end if;

  perform 1
  from public.user_currency_balances as balance
  where balance.user_id = v_user_id
    and balance.currency_code = v_destination_currency_code
    and balance.is_enabled
  for update;

  if not found then
    raise exception 'Enable the destination currency before converting';
  end if;

  select account.balance
  into v_source_balance
  from public.user_accounts as account
  join public.account_types as account_type
    on account_type.id = account.account_type_id
  where account.id = p_source_account_id
    and account.user_id = v_user_id
    and account.currency_code = 'USD'
    and account_type.name = 'Checking'
    and account_type.is_active
  for update of account;

  if not found then
    raise exception 'Choose your valid Checking account';
  end if;
  if v_source_balance < p_amount then
    raise exception 'Insufficient Checking balance';
  end if;

  select rate.rate
  into v_exchange_rate
  from public.exchange_rates as rate
  where rate.base_currency_code = 'USD'
    and rate.quote_currency_code = v_destination_currency_code;

  if v_exchange_rate is null then
    raise exception 'An exchange rate is unavailable for this conversion';
  end if;

  v_exchange_rate := round(v_exchange_rate, 12);
  v_destination_amount := round(p_amount * v_exchange_rate, 6);
  if v_destination_amount <= 0 then
    raise exception 'The converted amount is too small';
  end if;

  update public.user_accounts
  set balance = balance - p_amount
  where id = p_source_account_id
    and user_id = v_user_id;

  update public.user_currency_balances
  set balance = balance + v_destination_amount
  where user_id = v_user_id
    and currency_code = v_destination_currency_code
    and is_enabled;

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
  ) values (
    v_user_id,
    'USD',
    'currency_balance_from_bank',
    v_destination_currency_code,
    null,
    p_amount,
    v_exchange_rate,
    v_destination_amount,
    p_source_account_id
  ) returning * into v_conversion;

  return v_conversion;
end;
$$;

revoke all on function public.convert_checking_account_balance(
  uuid, numeric, text
) from public, anon;
grant execute on function public.convert_checking_account_balance(
  uuid, numeric, text
) to authenticated, service_role;

alter function public.request_currency_transfer(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) rename to request_currency_transfer_before_stablecoin_access;
revoke all on function public.request_currency_transfer_before_stablecoin_access(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) from public, anon, authenticated, service_role;

create function public.request_currency_transfer(
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
  if not exists (
    select 1 from public.currencies as currency
    where currency.code = v_currency_code
      and currency.is_active
      and currency.code <> 'USD'
  ) then
    raise exception 'This currency cannot be transferred';
  end if;

  if v_currency_code in ('EUR', 'AUD', 'AED', 'MXN', 'GBP', 'NZD')
    and (
      nullif(btrim(p_account_holder_name), '') is null
      or nullif(btrim(p_bank_name), '') is null
      or nullif(btrim(p_beneficiary_address), '') is null
    )
  then
    raise exception 'Account holder, bank name, and beneficiary address are required';
  end if;

  case v_currency_code
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
      if nullif(btrim(p_wallet_address), '') is null
        or btrim(p_network) <> 'Ethereum (ERC20)'
      then raise exception 'USDC transfers require an Ethereum (ERC20) wallet'; end if;
    when 'USDT' then
      if nullif(btrim(p_wallet_address), '') is null
        or btrim(p_network) <> 'Tron (TRC20)'
      then raise exception 'USDT transfers require a Tron (TRC20) wallet'; end if;
    else
      raise exception 'This currency cannot be transferred';
  end case;

  select balance.balance
  into v_balance
  from public.user_currency_balances as balance
  where balance.user_id = v_user_id
    and balance.currency_code = v_currency_code
    and balance.is_enabled
  for update;

  if not found then
    raise exception 'This currency balance is not enabled';
  end if;
  if v_balance < p_amount then
    raise exception 'Insufficient % balance', v_currency_code;
  end if;

  update public.user_currency_balances
  set balance = balance - p_amount
  where user_id = v_user_id
    and currency_code = v_currency_code
    and is_enabled;

  insert into public.currency_transfers (
    user_id,
    currency_code,
    amount,
    account_holder_name,
    bank_name,
    bank_address,
    beneficiary_address,
    account_number,
    account_type,
    routing_number,
    iban,
    swift_bic,
    sort_code,
    bsb,
    clabe,
    wallet_address,
    network
  ) values (
    v_user_id,
    v_currency_code,
    p_amount,
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

revoke all on function public.request_currency_transfer(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.request_currency_transfer(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) to authenticated, service_role;

comment on table public.currency_deposits is
  'Pending and reviewed deposits into approved fiat and stablecoin currency balances.';
comment on function public.convert_currency_balance(text, numeric, text, text, uuid) is
  'Atomically converts an approved non-USD fiat or stablecoin balance into another approved currency balance or the verified user Checking account.';
comment on function public.convert_checking_account_balance(uuid, numeric, text) is
  'Atomically converts a verified user Checking balance from USD into an approved non-USD fiat or stablecoin balance.';

-- Postflight assertions: access changes may not alter a single stored balance
-- or lose any pre-existing stablecoin row.
do $$
declare
  v_archived_count bigint;
  v_current_count bigint;
  v_archived_total numeric(30, 6);
  v_current_total numeric(30, 6);
begin
  select count(*), coalesce(sum(balance), 0)
  into v_archived_count, v_archived_total
  from private.stablecoin_access_balance_archive_20260930;

  select count(*), coalesce(sum(balance), 0)
  into v_current_count, v_current_total
  from public.user_currency_balances
  where currency_code in ('USDC', 'USDT');

  if v_archived_count <> v_current_count
    or v_archived_total <> v_current_total
  then
    raise exception
      'Stablecoin migration balance mismatch: archived % rows / %, current % rows / %',
      v_archived_count,
      v_archived_total,
      v_current_count,
      v_current_total;
  end if;

  if exists (
    select 1
    from public.user_currency_balances
    where currency_code in ('USDC', 'USDT')
      and is_enabled
  ) then
    raise exception 'Stablecoin migration stopped: existing access was not fully revoked';
  end if;
end;
$$;

commit;
