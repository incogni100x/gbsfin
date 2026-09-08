begin;
create extension if not exists pgtap with schema extensions;

create temporary table tap_results (result text not null) on commit drop;
grant select, insert on tap_results to authenticated;

insert into tap_results select plan(20);
insert into tap_results select has_table('public', 'loan_payments', 'loan payment ledger exists');
insert into tap_results select has_pk('public', 'loan_payments', 'loan payments have a primary key');
insert into tap_results select has_column('public', 'loan_payments', 'idempotency_key', 'manual payments retain an idempotency key');
insert into tap_results select ok((select relrowsecurity from pg_class where oid = 'public.loan_payments'::regclass), 'loan payments use RLS');
insert into tap_results select policies_are('public', 'loan_payments', array['loan_payments_owner_read'], 'owners can read their payment history');
insert into tap_results select has_function('public', 'make_loan_payment', array['uuid','uuid','numeric','uuid'], 'manual payment RPC exists');
insert into tap_results select ok(has_function_privilege('authenticated', 'public.make_loan_payment(uuid,uuid,numeric,uuid)', 'EXECUTE'), 'authenticated users can make payments');
insert into tap_results select ok(not has_function_privilege('anon', 'public.make_loan_payment(uuid,uuid,numeric,uuid)', 'EXECUTE'), 'anonymous users cannot make payments');
insert into tap_results select ok(not has_table_privilege('authenticated', 'public.loan_payments', 'INSERT'), 'users cannot insert ledger rows directly');
insert into tap_results select ok(not has_function_privilege('authenticated', 'public.process_due_loan_payments(date)', 'EXECUTE'), 'scheduled processor remains service-role only');

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
values
  ('33000000-0000-4000-8000-000000000001', 'loan-payment@example.invalid', '{"provider":"email","providers":["email"]}', '{"first_name":"Loan","last_name":"Payment"}', false, false),
  ('33000000-0000-4000-8000-000000000002', 'other-loan-payment@example.invalid', '{"provider":"email","providers":["email"]}', '{"first_name":"Other","last_name":"User"}', false, false);

insert into public.user_accounts (id, user_id, account_type_id, account_number, balance, currency_code)
values
  ('33000000-0000-4000-8000-000000000010', '33000000-0000-4000-8000-000000000001', 2, 'TEST-LOAN-PAY-USD', 2500, 'USD'),
  ('33000000-0000-4000-8000-000000000011', '33000000-0000-4000-8000-000000000001', 1, 'TEST-LOAN-PAY-MXN', 2000, 'MXN'),
  ('33000000-0000-4000-8000-000000000012', '33000000-0000-4000-8000-000000000002', 2, 'TEST-LOAN-PAY-OTHER', 2500, 'USD');

insert into public.loans (
  id, user_id, account_id, loan_type_id, plan_id, amount, reason, status,
  annual_interest_rate, duration_months, monthly_payment, remaining_balance,
  remaining_months, next_due_date, overdue_count, is_overdue, overdue_amount
)
values
  ('33000000-0000-4000-8000-000000000020', '33000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000010', 1, 1, 1000, 'Emergency expenses', 'active', 6.5, 6, 170, 1000, 6, current_date + 10, 1, true, 100),
  ('33000000-0000-4000-8000-000000000021', '33000000-0000-4000-8000-000000000001', '33000000-0000-4000-8000-000000000010', 1, 1, 100, 'Emergency expenses', 'active', 6.5, 6, 17, 100, 6, current_date + 10, 0, false, 0);

select set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', '33000000-0000-4000-8000-000000000001', 'session_id', '33000000-0000-4000-8000-000000000003')::text,
  true
);
set local role authenticated;

select public.set_security_answers('[{"question_id":"favorite_color","answer":"amber"},{"question_id":"favorite_food","answer":"rice"},{"question_id":"birth_city","answer":"lagos"}]'::jsonb);

select public.make_loan_payment(
  '33000000-0000-4000-8000-000000000020',
  '33000000-0000-4000-8000-000000000010',
  150,
  '33000000-0000-4000-8000-000000000030'
);

insert into tap_results select is((select overdue_amount from public.loans where id = '33000000-0000-4000-8000-000000000020'), 0::numeric, 'manual payment clears overdue balance first');
insert into tap_results select is((select remaining_balance from public.loans where id = '33000000-0000-4000-8000-000000000020'), 950::numeric, 'remainder reduces principal');
insert into tap_results select ok((select monthly_payment < 170 from public.loans where id = '33000000-0000-4000-8000-000000000020'), 'monthly payment is recalculated after principal reduction');
insert into tap_results select is((select count(*)::integer from public.loan_payments where loan_id = '33000000-0000-4000-8000-000000000020'), 1, 'payment creates one ledger row');

select public.make_loan_payment(
  '33000000-0000-4000-8000-000000000020',
  '33000000-0000-4000-8000-000000000010',
  150,
  '33000000-0000-4000-8000-000000000030'
);

insert into tap_results select is((select count(*)::integer from public.loan_payments where loan_id = '33000000-0000-4000-8000-000000000020'), 1, 'retrying an idempotent payment does not duplicate it');
insert into tap_results select is((select balance from public.user_accounts where id = '33000000-0000-4000-8000-000000000010'), 2350::numeric, 'idempotent retry does not debit twice');

select public.make_loan_payment(
  '33000000-0000-4000-8000-000000000021',
  '33000000-0000-4000-8000-000000000011',
  10,
  '33000000-0000-4000-8000-000000000031'
);

reset role;

insert into tap_results select is(
  (select source_debit_amount from public.loan_payments where idempotency_key = '33000000-0000-4000-8000-000000000031'),
  round(10 * (select rate from public.exchange_rates where base_currency_code = 'USD' and quote_currency_code = 'MXN'), 2),
  'foreign-currency source debit uses the stored USD exchange rate'
);

insert into tap_results select is(
  (select count(*)::integer from public.transactions where loan_id in ('33000000-0000-4000-8000-000000000020', '33000000-0000-4000-8000-000000000021')),
  2,
  'successful payments appear once in transaction history'
);

select set_config(
  'request.jwt.claims',
  json_build_object('role', 'authenticated', 'sub', '33000000-0000-4000-8000-000000000001', 'session_id', '33000000-0000-4000-8000-000000000003')::text,
  true
);
set local role authenticated;

insert into tap_results select throws_like(
  $$select public.make_loan_payment('33000000-0000-4000-8000-000000000020', '33000000-0000-4000-8000-000000000012', 10, '33000000-0000-4000-8000-000000000032')$$,
  '%valid bank account%',
  'another user account cannot fund a payment'
);

select public.make_loan_payment(
  '33000000-0000-4000-8000-000000000020',
  '33000000-0000-4000-8000-000000000010',
  950,
  '33000000-0000-4000-8000-000000000033'
);

reset role;
insert into tap_results select is((select status::text from public.loans where id = '33000000-0000-4000-8000-000000000020'), 'completed', 'paying total due completes the loan');

insert into tap_results select * from finish();
select result from tap_results;
rollback;
