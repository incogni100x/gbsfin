begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_column(
  'public',
  'user_currency_balances',
  'is_enabled',
  'currency balances have a revocable access switch'
);

select is(
  (
    select count(*)::integer
    from public.currencies
    where code in ('USDC', 'USDT')
      and currency_kind = 'stablecoin'
      and is_active
  ),
  2,
  'USDC and USDT remain active stablecoins'
);

select is(
  (
    select count(*)::integer
    from public.exchange_rates
    where base_currency_code = 'USD'
      and quote_currency_code in ('USDC', 'USDT')
      and rate > 0
  ),
  2,
  'both stablecoins have USD exchange rates'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.request_currency_access(text)',
    'EXECUTE'
  ),
  'authenticated users can request stablecoin access'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.request_currency_access(text)',
    'EXECUTE'
  ),
  'anonymous users cannot request currency access'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.submit_stablecoin_deposit_request(uuid,text,uuid,numeric,text)',
    'EXECUTE'
  ),
  'the obsolete stablecoin-to-bank deposit RPC is disabled'
);

select ok(
  position(
    'balance.is_enabled' in pg_get_functiondef(
      'public.convert_currency_balance(text,numeric,text,text,uuid)'::regprocedure
    )
  ) > 0,
  'currency conversions require enabled balances'
);

select ok(
  position(
    'currency_kind = ''fiat''' in pg_get_functiondef(
      'public.convert_currency_balance(text,numeric,text,text,uuid)'::regprocedure
    )
  ) = 0,
  'currency conversions are no longer fiat-only'
);

select ok(
  position(
    'balance.is_enabled' in pg_get_functiondef(
      'public.convert_checking_account_balance(uuid,numeric,text)'::regprocedure
    )
  ) > 0,
  'Checking conversions require an enabled destination balance'
);

select ok(
  position(
    'balance.is_enabled' in pg_get_functiondef(
      'public.request_currency_transfer(text,numeric,text,text,text,text,text,text,text,text,text,text,text,text,text,text)'::regprocedure
    )
  ) > 0,
  'external stablecoin transfers require enabled access'
);

select ok(
  position(
    'is_enabled' in (
      select qual
      from pg_policies
      where schemaname = 'public'
        and tablename = 'user_currency_balances'
        and policyname = 'user_currency_balances_owner_read'
    )
  ) > 0,
  'disabled balances are hidden by RLS'
);

select ok(
  position(
    'is_enabled' in (
      select qual
      from pg_policies
      where schemaname = 'public'
        and tablename = 'deposit_instructions'
        and policyname = 'deposit_instructions_approved_currency_read'
    )
  ) > 0,
  'wallet instructions require enabled access'
);

select ok(
  not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.currency_deposits'::regclass
      and conname = 'currency_deposits_fiat_only_check'
  ),
  'currency deposits accept approved stablecoin balances'
);

select is(
  (
    select count(*)
    from private.stablecoin_access_balance_archive_20260930
  ),
  (
    select count(*)
    from public.user_currency_balances
    where currency_code in ('USDC', 'USDT')
  ),
  'stablecoin balance row count was preserved'
);

select is(
  (
    select coalesce(sum(balance), 0)
    from private.stablecoin_access_balance_archive_20260930
  ),
  (
    select coalesce(sum(balance), 0)
    from public.user_currency_balances
    where currency_code in ('USDC', 'USDT')
  ),
  'stablecoin balance total was preserved'
);

select * from finish();

rollback;
