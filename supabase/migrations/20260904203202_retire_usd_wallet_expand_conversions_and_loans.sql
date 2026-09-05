begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

-- USD remains the settlement currency for bank accounts and exchange-rate
-- calculations, but it is no longer offered as a standalone currency wallet.
-- Existing USD wallet rows are deliberately retained so no financial history
-- or balance is destroyed while the product team reconciles them.
update public.currencies
set is_active = false
where code = 'USD';

update public.deposit_instructions
set is_active = false
where currency_code = 'USD';

alter function public.convert_currency_balance(text, numeric, text)
  rename to convert_currency_balance_before_usd_retirement;

revoke all on function public.convert_currency_balance_before_usd_retirement(
  text, numeric, text
) from public, anon, authenticated, service_role;

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
      and destination_currency_code = 'USD'
      and exchange_rate = 1
    )
  ) not valid;

alter table public.currency_conversions
  validate constraint currency_conversions_destination_check;

create or replace function public.convert_currency_balance(
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
      );
  else
    if p_destination_account_id is null then
      raise exception 'Choose a USD bank account';
    end if;

    if v_destination_currency_code is not null
      and v_destination_currency_code <> 'USD'
    then
      raise exception 'Currency balances can only convert into USD bank accounts';
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
    where account.id = p_destination_account_id
      and account.user_id = v_user_id
      and account.currency_code = 'USD'
    for update;

    if not found then
      raise exception 'Choose a valid USD bank account';
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
is 'Atomically converts an enabled non-USD fiat wallet into another enabled fiat wallet or a user-owned USD bank account.';

insert into public.loan_types (name, description, is_investment)
values
  ('Home Equity Line of Credit (HELOC)', 'Flexible financing secured by available home equity.', false),
  ('SBA Loans', 'Longer-term financing for eligible small-business needs.', false),
  ('Commercial Real Estate', 'Financing for purchasing or improving commercial property.', false),
  ('Lines of Credit', 'Reusable credit for short-term personal or business cash-flow needs.', false)
on conflict (name) do update
set description = excluded.description,
    is_investment = excluded.is_investment,
    is_active = true;

insert into public.loan_plans (duration_months, annual_interest_rate)
values
  (24, 4.95), (60, 5.10), (120, 5.25),
  (24, 4.25), (60, 4.50), (120, 4.75),
  (24, 5.15), (60, 5.30), (120, 5.45), (180, 5.55),
  (12, 3.25), (24, 3.75), (60, 4.10)
on conflict (duration_months, annual_interest_rate) do update
set is_active = true;

with eligible_plans (loan_type_name, duration_months, annual_interest_rate) as (
  values
    ('Home Equity Line of Credit (HELOC)', 24, 4.95::numeric),
    ('Home Equity Line of Credit (HELOC)', 60, 5.10::numeric),
    ('Home Equity Line of Credit (HELOC)', 120, 5.25::numeric),
    ('SBA Loans', 24, 4.25::numeric),
    ('SBA Loans', 60, 4.50::numeric),
    ('SBA Loans', 120, 4.75::numeric),
    ('Commercial Real Estate', 24, 5.15::numeric),
    ('Commercial Real Estate', 60, 5.30::numeric),
    ('Commercial Real Estate', 120, 5.45::numeric),
    ('Commercial Real Estate', 180, 5.55::numeric),
    ('Lines of Credit', 12, 3.25::numeric),
    ('Lines of Credit', 24, 3.75::numeric),
    ('Lines of Credit', 60, 4.10::numeric)
)
insert into public.loan_type_plans (loan_type_id, plan_id)
select loan_type.id, plan.id
from eligible_plans as eligible
join public.loan_types as loan_type
  on loan_type.name = eligible.loan_type_name
join public.loan_plans as plan
  on plan.duration_months = eligible.duration_months
  and plan.annual_interest_rate = eligible.annual_interest_rate
on conflict (loan_type_id, plan_id) do nothing;

do $$
begin
  if exists (
    select 1
    from public.loan_type_plans as eligibility
    join public.loan_types as loan_type on loan_type.id = eligibility.loan_type_id
    join public.loan_plans as plan on plan.id = eligibility.plan_id
    where loan_type.name in (
      'Home Equity Line of Credit (HELOC)',
      'SBA Loans',
      'Commercial Real Estate',
      'Lines of Credit'
    )
      and plan.annual_interest_rate >= 5.70
  ) then
    raise exception 'New loan product rates must remain below the mortgage rate floor';
  end if;
end;
$$;

commit;
