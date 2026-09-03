begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

select has_type('public', 'request_status', 'request status enum exists');
select has_table('public', 'currencies', 'currencies exists');
select has_table('public', 'exchange_rates', 'exchange rates exists');
select has_table(
  'public',
  'user_currency_balances',
  'user currency balances exists'
);
select has_table(
  'public',
  'currency_access_requests',
  'currency access requests exists'
);
select has_column(
  'public',
  'currency_access_requests',
  'application_reference',
  'currency requests expose a support-safe application reference'
);
select col_not_null(
  'public',
  'currency_access_requests',
  'application_reference',
  'every currency request has an application reference'
);
select has_trigger(
  'public',
  'currency_access_requests',
  'currency_access_requests_set_application_reference',
  'new currency requests receive an application reference'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.currency_access_requests'::regclass
      and conname = 'currency_access_requests_application_reference_key'
      and contype = 'u'
  ),
  'currency application references are unique'
);
select has_table(
  'public',
  'deposit_instructions',
  'deposit instructions exists'
);
select has_table(
  'public',
  'currency_deposits',
  'currency deposits exists'
);

select has_column(
  'public',
  'currency_deposits',
  'created_at',
  'currency deposits retain one frontend transaction date'
);
select hasnt_column(
  'public',
  'currency_deposits',
  'reviewed_at',
  'currency deposits do not duplicate the review date'
);
select hasnt_column(
  'public',
  'currency_deposits',
  'credited_at',
  'currency deposits do not duplicate the credit date'
);
select hasnt_column(
  'public',
  'currency_deposits',
  'updated_at',
  'currency deposits do not store an unused update date'
);

select hasnt_column(
  'public',
  'deposit_instructions',
  'bank_name',
  'deposit instructions do not store a bank name'
);
select hasnt_column(
  'public',
  'deposit_instructions',
  'bank_address',
  'deposit instructions do not store a bank address'
);
select hasnt_column(
  'public',
  'deposit_instructions',
  'is_demo',
  'deposit instructions do not store a demo flag'
);

select is(
  (select count(*)::integer from public.currencies),
  9,
  'all nine currencies are installed'
);
select is(
  (select count(*)::integer from public.exchange_rates),
  9,
  'all nine USD exchange rates are installed'
);
select is(
  (select count(*)::integer from public.deposit_instructions),
  9,
  'all nine shared deposit instructions are installed'
);

select is(
  (
    select count(*)::integer
    from public.deposit_instructions
    where concat_ws(
      ' ',
      beneficiary_name,
      account_number,
      routing_number,
      iban,
      swift_bic,
      sort_code,
      bsb,
      clabe
    ) ilike '%demo%'
  ),
  0,
  'deposit instructions contain no demo labels'
);

select is(
  (
    select beneficiary_name
    from public.deposit_instructions
    where currency_code = 'USD'
  ),
  'Global Stripe Fin',
  'fiat deposit instructions use the production-facing beneficiary name'
);

select is(
  (
    select wallet_address
    from public.deposit_instructions
    where currency_code = 'USDT'
  ),
  'TDcCG4odFYy1cx9fMoYnfHeby2fs93EeK6',
  'USDT uses the supplied TRC20 address'
);
select is(
  (
    select wallet_address
    from public.deposit_instructions
    where currency_code = 'USDC'
  ),
  '0x18341D82921BA3eA32Bec09f47a1802D9751FC68',
  'USDC uses the supplied ERC20 address'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.currencies'::regclass),
  'currencies has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.exchange_rates'::regclass),
  'exchange rates has RLS enabled'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.user_currency_balances'::regclass
  ),
  'user currency balances has RLS enabled'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.currency_access_requests'::regclass
  ),
  'currency access requests has RLS enabled'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.deposit_instructions'::regclass
  ),
  'deposit instructions has RLS enabled'
);
select ok(
  (
    select position('USDC' in qual) > 0 and position('USDT' in qual) > 0
    from pg_policies
    where schemaname = 'public'
      and tablename = 'deposit_instructions'
      and policyname = 'deposit_instructions_approved_currency_read'
  ),
  'verified users can read active USDC and USDT payment instructions'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.currency_deposits'::regclass
  ),
  'currency deposits has RLS enabled'
);

select has_function(
  'public',
  'request_currency_access',
  array['text'],
  'currency request RPC exists'
);

select is(
  (
    select proc.prosecdef
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'request_currency_access'
      and pg_get_function_identity_arguments(proc.oid) = 'p_currency_code text'
  ),
  false,
  'currency request RPC runs with invoker privileges'
);

select ok(
  (
    select rate = 3.6725
    from public.exchange_rates
    where base_currency_code = 'USD'
      and quote_currency_code = 'AED'
  ),
  'USD to AED seed rate is installed'
);

select * from finish();

rollback;
