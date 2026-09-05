begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

select is(
  (select is_active from public.currencies where code = 'USD'),
  false,
  'the USD currency wallet is retired'
);

select is(
  (select count(*)::integer from public.currencies
   where currency_kind = 'fiat' and is_active and code <> 'USD'),
  6,
  'six non-USD fiat currencies remain active'
);

select ok(
  exists (select 1 from public.exchange_rates
          where base_currency_code = 'USD' and quote_currency_code = 'USD'),
  'USD remains available as the exchange-rate base currency'
);

select ok(
  position('destination_currency_code = ''USD''' in
    pg_get_constraintdef((
      select oid from pg_constraint
      where conrelid = 'public.currency_conversions'::regclass
        and conname = 'currency_conversions_destination_check'
    ))) > 0,
  'conversion ledger accepts USD bank-account destinations'
);

select ok(
  (select bool_and(is_active) from public.currencies
   where code in ('USDC', 'USDT')),
  'stablecoin deposit rails remain active'
);

select * from finish();

rollback;
