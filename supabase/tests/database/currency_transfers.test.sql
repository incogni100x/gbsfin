begin;
create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  result text not null
) on commit drop;

grant select, insert on tap_results to authenticated;

insert into tap_results select plan(29);
insert into tap_results select has_table('public','currency_conversions','currency conversion ledger exists');
insert into tap_results select has_pk('public','currency_conversions','currency conversions have a primary key');
insert into tap_results select has_column('public','currency_conversions','exchange_rate','applied rate is retained');
insert into tap_results select has_column('public','currency_conversions','created_at','conversion has one displayed date');
insert into tap_results select hasnt_column('public','currency_conversions','completed_at','conversion does not duplicate dates');
insert into tap_results select ok((select relrowsecurity from pg_class where oid='public.currency_conversions'::regclass),'currency conversions use RLS');
insert into tap_results select policies_are('public','currency_conversions',array['currency_conversions_owner_read'],'owners can only read their conversions');
insert into tap_results select has_function('public','convert_currency_balance',array['text','numeric','text','text','uuid'],'atomic conversion RPC supports currency and Checking destinations');
insert into tap_results select is((select proc.prosecdef from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace where n.nspname='public' and proc.proname='convert_currency_balance'),true,'conversion RPC uses definer privileges');
insert into tap_results select is((select proc.proconfig from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace where n.nspname='public' and proc.proname='convert_currency_balance'),array['search_path=""'],'conversion RPC has an empty search path');
insert into tap_results select ok(has_function_privilege('authenticated','public.convert_currency_balance(text,numeric,text,text,uuid)','EXECUTE'),'users can invoke conversion RPC');
insert into tap_results select ok(not has_function_privilege('anon','public.convert_currency_balance(text,numeric,text,text,uuid)','EXECUTE'),'anonymous users cannot convert');
insert into tap_results select ok(not has_table_privilege('authenticated','public.currency_conversions','INSERT'),'users cannot insert conversion rows directly');
insert into tap_results select ok(not has_function_privilege('authenticated','public.convert_currency_balance_before_usd_retirement(text,numeric,text)','EXECUTE'),'retired USD-wallet conversion RPC is revoked');
insert into tap_results select ok(not has_function_privilege('authenticated','public.transfer_currency_balance_legacy(text,numeric,text,text,uuid)','EXECUTE'),'legacy mixed RPC is revoked');
insert into tap_results select ok(not has_function_privilege('authenticated','public.transfer_bank_account_to_usd_balance_legacy(uuid,numeric)','EXECUTE'),'bank-to-USD legacy RPC is revoked');
insert into tap_results select has_function('public','convert_checking_account_balance',array['uuid','numeric','text'],'atomic Checking-to-currency RPC exists');
insert into tap_results select is((select proc.prosecdef from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace where n.nspname='public' and proc.proname='convert_checking_account_balance'),true,'Checking conversion RPC uses definer privileges');
insert into tap_results select is((select proc.proconfig from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace where n.nspname='public' and proc.proname='convert_checking_account_balance'),array['search_path=""'],'Checking conversion RPC has an empty search path');
insert into tap_results select ok(has_function_privilege('authenticated','public.convert_checking_account_balance(uuid,numeric,text)','EXECUTE'),'users can invoke Checking conversion RPC');
insert into tap_results select ok(not has_function_privilege('anon','public.convert_checking_account_balance(uuid,numeric,text)','EXECUTE'),'anonymous users cannot convert Checking balances');

insert into auth.users (
  id,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values (
  '32000000-0000-4000-8000-000000000001',
  'checking-conversion@example.invalid',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Checking","last_name":"Conversion"}'::jsonb,
  false,
  false
);

insert into public.user_accounts (
  id, user_id, account_type_id, account_number, balance, currency_code
)
select
  '32000000-0000-4000-8000-000000000010',
  '32000000-0000-4000-8000-000000000001',
  account_type.id,
  'TEST-CHECKING-CONVERSION',
  1000,
  'USD'
from public.account_types as account_type
where account_type.name = 'Checking';

insert into public.user_accounts (
  id, user_id, account_type_id, account_number, balance, currency_code
)
select
  '32000000-0000-4000-8000-000000000011',
  '32000000-0000-4000-8000-000000000001',
  account_type.id,
  'TEST-SAVINGS-CONVERSION',
  1000,
  'USD'
from public.account_types as account_type
where account_type.name = 'Savings';

insert into public.user_currency_balances (user_id, currency_code, balance)
values
  ('32000000-0000-4000-8000-000000000001', 'EUR', 100),
  ('32000000-0000-4000-8000-000000000001', 'GBP', 0)
on conflict (user_id, currency_code) do update
set balance = excluded.balance;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '32000000-0000-4000-8000-000000000001',
    'session_id', '32000000-0000-4000-8000-000000000002'
  )::text,
  true
);

set local role authenticated;

select public.set_security_answers(
  '[
    {"question_id":"favorite_color","answer":"amber"},
    {"question_id":"favorite_food","answer":"rice"},
    {"question_id":"birth_city","answer":"lagos"}
  ]'::jsonb
);

select public.convert_checking_account_balance(
  '32000000-0000-4000-8000-000000000010',
  100,
  'EUR'
);

insert into tap_results select throws_like(
  $$
    select public.convert_checking_account_balance(
      '32000000-0000-4000-8000-000000000011', 10, 'EUR'
    )
  $$,
  '%valid Checking account%',
  'Savings cannot be used as the source of a currency conversion'
);

insert into tap_results select throws_like(
  $$
    select public.convert_currency_balance(
      'EUR', 10, 'bank_account', 'USD',
      '32000000-0000-4000-8000-000000000011'
    )
  $$,
  '%valid Checking account%',
  'a currency cannot convert into Savings'
);

insert into tap_results select throws_like(
  $$
    select public.convert_checking_account_balance(
      '32000000-0000-4000-8000-000000000010', 10000, 'GBP'
    )
  $$,
  '%Insufficient Checking balance%',
  'an insufficient Checking balance is rejected atomically'
);

select public.convert_currency_balance(
  'EUR',
  10,
  'bank_account',
  'USD',
  '32000000-0000-4000-8000-000000000010'
);

reset role;

insert into tap_results select is(
  (select balance from public.user_accounts where id = '32000000-0000-4000-8000-000000000010'),
  900 + round(10 / (select rate from public.exchange_rates where base_currency_code = 'USD' and quote_currency_code = 'EUR'), 2),
  'bidirectional conversions update the Checking balance'
);

insert into tap_results select is(
  (select balance from public.user_currency_balances where user_id = '32000000-0000-4000-8000-000000000001' and currency_code = 'EUR'),
  90 + round(100 * (select rate from public.exchange_rates where base_currency_code = 'USD' and quote_currency_code = 'EUR'), 6),
  'bidirectional conversions update the currency balance'
);

insert into tap_results select is(
  (select source_account_id from public.currency_conversions where destination_type = 'currency_balance_from_bank' and user_id = '32000000-0000-4000-8000-000000000001'),
  '32000000-0000-4000-8000-000000000010'::uuid,
  'Checking-to-currency history retains its source account'
);

insert into tap_results select is(
  (select destination_account_id from public.currency_conversions where destination_type = 'bank_account' and user_id = '32000000-0000-4000-8000-000000000001'),
  '32000000-0000-4000-8000-000000000010'::uuid,
  'currency-to-Checking history retains its destination account'
);

insert into tap_results select is(
  (
    select count(*)::integer
    from public.currency_conversions
    where user_id = '32000000-0000-4000-8000-000000000001'
  ),
  2,
  'failed conversions do not create ledger entries'
);
insert into tap_results select * from finish();

select result
from tap_results;

rollback;
