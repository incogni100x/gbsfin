begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

do $$
declare
  v_checking_type_count integer;
begin
  select count(*)
  into v_checking_type_count
  from public.account_types as account_type
  where account_type.name = 'Checking'
    and account_type.is_active;

  if v_checking_type_count <> 1 then
    raise exception
      'Migration stopped: exactly one active Checking account type is required';
  end if;
end;
$$;

-- Preserve the current onboarding function so the companion rollback can
-- restore its exact behavior without rebuilding historical SQL by hand.
alter function public.open_accounts(integer[], text)
  rename to open_accounts_before_required_checking;

revoke all on function public.open_accounts_before_required_checking(
  integer[], text
) from public, anon, authenticated, service_role;

create function public.open_accounts(
  p_account_type_ids integer[],
  p_currency_code text default 'USD'
)
returns setof public.user_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency_code text := upper(btrim(p_currency_code));
  v_requested_count integer;
  v_distinct_count integer;
  v_checking_account_type_id smallint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required to open accounts';
  end if;

  select account_type.id
  into v_checking_account_type_id
  from public.account_types as account_type
  where account_type.name = 'Checking'
    and account_type.is_active;

  if not found then
    raise exception 'The required Checking account type is unavailable';
  end if;

  select count(*), count(distinct requested.account_type_id)
  into v_requested_count, v_distinct_count
  from unnest(coalesce(p_account_type_ids, array[]::integer[]))
    as requested(account_type_id);

  if v_requested_count <> 3 or v_distinct_count <> 3 then
    raise exception 'Exactly three distinct account types are required';
  end if;

  if not (v_checking_account_type_id = any(p_account_type_ids)) then
    raise exception 'Checking must be included in the selected account types';
  end if;

  if (
    select count(*)
    from public.account_types as account_type
    where account_type.id = any(p_account_type_ids)
      and account_type.is_active
  ) <> 3 then
    raise exception 'Every selected account type must be active and valid';
  end if;

  if v_currency_code !~ '^[A-Z]{3,4}$' then
    raise exception 'Invalid currency code';
  end if;

  return query
  insert into public.user_accounts (
    user_id,
    account_type_id,
    account_number,
    currency_code
  )
  select
    v_user_id,
    requested.account_type_id::smallint,
    nextval('public.account_number_seq')::text,
    v_currency_code
  from unnest(p_account_type_ids) as requested(account_type_id)
  on conflict on constraint user_accounts_user_type_currency_key
  do update set user_id = excluded.user_id
  returning *;
end;
$$;

revoke all on function public.open_accounts(integer[], text)
  from public, anon;
grant execute on function public.open_accounts(integer[], text)
  to authenticated, service_role;

comment on function public.open_accounts(integer[], text)
is 'Atomically opens exactly three accounts for the verified user and requires the standard Checking account type.';

-- Keep the existing historical USD-to-USD bank funding shape valid while
-- adding the new Checking-to-enabled-currency conversion shape.
alter table public.currency_conversions
  drop constraint currency_conversions_destination_check;

alter table public.currency_conversions
  add constraint currency_conversions_destination_check check (
    (
      destination_type = 'currency_balance'
      and source_account_id is null
      and destination_account_id is null
      and source_currency_code <> destination_currency_code
    )
    or (
      destination_type = 'bank_account'
      and source_account_id is null
      and destination_account_id is not null
      and destination_currency_code = 'USD'
    )
    or (
      destination_type = 'currency_balance_from_bank'
      and source_account_id is not null
      and destination_account_id is null
      and source_currency_code = 'USD'
      and (
        destination_currency_code <> 'USD'
        or (
          destination_currency_code = 'USD'
          and exchange_rate = 1
        )
      )
    )
  ) not valid;

alter table public.currency_conversions
  validate constraint currency_conversions_destination_check;

-- Preserve the current conversion function for a non-destructive rollback.
alter function public.convert_currency_balance(
  text, numeric, text, text, uuid
) rename to convert_currency_balance_before_checking_requirement;

revoke all on function public.convert_currency_balance_before_checking_requirement(
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
    select 1
    from public.currencies as currency
    where currency.code = v_source_currency_code
      and currency.currency_kind = 'fiat'
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
      select 1
      from public.currencies as currency
      where currency.code = v_destination_currency_code
        and currency.currency_kind = 'fiat'
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
      max(rate.rate) filter (
        where rate.quote_currency_code = v_source_currency_code
      ),
      max(rate.rate) filter (
        where rate.quote_currency_code = v_destination_currency_code
      )
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
      );
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
      and currency_code = v_source_currency_code;

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

comment on function public.convert_currency_balance(text, numeric, text, text, uuid)
is 'Atomically converts an enabled non-USD fiat balance into another enabled fiat balance or the verified user standard Checking account.';

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
    select 1
    from public.currencies as currency
    where currency.code = v_destination_currency_code
      and currency.currency_kind = 'fiat'
      and currency.is_active
      and currency.code <> 'USD'
  ) then
    raise exception 'Choose an available destination currency';
  end if;

  -- Currency rows are locked before account rows in both conversion
  -- directions to maintain a consistent lock order under concurrency.
  perform 1
  from public.user_currency_balances as balance
  where balance.user_id = v_user_id
    and balance.currency_code = v_destination_currency_code
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
    and currency_code = v_destination_currency_code;

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

comment on function public.convert_checking_account_balance(uuid, numeric, text)
is 'Atomically converts a verified user standard Checking balance from USD into an enabled non-USD fiat currency balance.';

commit;
