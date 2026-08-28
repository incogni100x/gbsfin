begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  result text not null
) on commit drop;

grant select, insert on tap_results to authenticated;

insert into tap_results (result)
select plan(27);

insert into tap_results (result)
select has_table(
  'public',
  'currency_withdrawals',
  'currency withdrawal requests exist'
);

insert into tap_results (result)
select has_pk(
  'public',
  'currency_withdrawals',
  'currency withdrawals have a primary key'
);

insert into tap_results (result)
select has_column(
  'public',
  'currency_withdrawals',
  'status',
  'withdrawals track review status'
);

insert into tap_results (result)
select has_column(
  'public',
  'currency_withdrawals',
  'submitted_at',
  'withdrawals preserve their original submission timestamp'
);

insert into tap_results (result)
select has_trigger(
  'public',
  'currency_withdrawals',
  'currency_withdrawals_review',
  'withdrawal enum updates run the review workflow'
);

insert into tap_results (result)
select col_type_is(
  'public',
  'currency_withdrawals',
  'status',
  'request_status',
  'withdrawals reuse the shared request status enum'
);

insert into tap_results (result)
select has_check(
  'public',
  'currency_withdrawals',
  'withdrawals have database checks'
);

insert into tap_results (result)
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.currency_withdrawals'::regclass
  ),
  'currency withdrawals have RLS enabled'
);

insert into tap_results (result)
select policies_are(
  'public',
  'currency_withdrawals',
  array['currency_withdrawals_owner_read'],
  'users can only read their own withdrawals'
);

insert into tap_results (result)
select has_function(
  'public',
  'request_currency_withdrawal',
  array[
    'text', 'numeric', 'text', 'text', 'text', 'text', 'text', 'text',
    'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text'
  ],
  'atomic withdrawal request RPC exists'
);

insert into tap_results (result)
select has_function(
  'public',
  'review_currency_withdrawal',
  array['uuid', 'text', 'text'],
  'withdrawal review RPC exists'
);

insert into tap_results (result)
select ok(
  has_function_privilege(
    'authenticated',
    'public.request_currency_withdrawal(text,numeric,text,text,text,text,text,text,text,text,text,text,text,text,text,text)',
    'EXECUTE'
  ),
  'authenticated users can request withdrawals'
);

insert into tap_results (result)
select ok(
  not has_function_privilege(
    'authenticated',
    'public.review_currency_withdrawal(uuid,text,text)',
    'EXECUTE'
  ),
  'authenticated users cannot review withdrawals'
);

insert into tap_results (result)
select ok(
  not has_table_privilege(
    'authenticated',
    'public.currency_withdrawals',
    'INSERT'
  ),
  'authenticated users cannot bypass the request RPC'
);

insert into tap_results (result)
select ok(
  not has_table_privilege(
    'authenticated',
    'public.currency_withdrawals',
    'UPDATE'
  ),
  'authenticated users cannot approve their own withdrawals'
);

insert into auth.users (
  id,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values (
  '30000000-0000-4000-8000-000000000001',
  'currency-withdrawal-test@example.invalid',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Currency","last_name":"Test"}'::jsonb,
  false,
  false
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '30000000-0000-4000-8000-000000000001',
    'session_id', '30000000-0000-4000-8000-000000000002'
  )::text,
  true
);

set local role authenticated;

select public.set_security_answers(
  '[
    {"question_id":"favorite_color","answer":"blue"},
    {"question_id":"favorite_food","answer":"rice"},
    {"question_id":"birth_city","answer":"lagos"}
  ]'::jsonb
);

reset role;

update public.user_currency_balances
set balance = 100
where user_id = '30000000-0000-4000-8000-000000000001'
  and currency_code = 'USD';

set local role authenticated;

insert into tap_results (result)
select lives_ok(
  $$
    select public.request_currency_withdrawal(
      p_currency_code => 'USD',
      p_amount => 25,
      p_account_holder_name => 'Currency Test',
      p_bank_name => 'Test Bank',
      p_beneficiary_address => '1 Main Street, Lagos',
      p_account_number => '1234567890',
      p_account_type => 'checking',
      p_routing_number => '021000021'
    )
  $$,
  'a verified user can submit a valid withdrawal'
);

insert into tap_results (result)
select is(
  (
    select status::text
    from public.currency_withdrawals
    where user_id = '30000000-0000-4000-8000-000000000001'
    order by created_at desc
    limit 1
  ),
  'pending',
  'new withdrawals are pending'
);

insert into tap_results (result)
select is(
  (
    select balance
    from public.user_currency_balances
    where user_id = '30000000-0000-4000-8000-000000000001'
      and currency_code = 'USD'
  ),
  75::numeric,
  'submitting a withdrawal reserves the requested funds'
);

reset role;

insert into tap_results (result)
select lives_ok(
  format(
    'update public.currency_withdrawals set status = %L, review_note = %L where id = %L::uuid',
    'rejected',
    'Details could not be verified',
    (
      select id
      from public.currency_withdrawals
      where user_id = '30000000-0000-4000-8000-000000000001'
      order by created_at desc
      limit 1
    )
  ),
  'an administrator can reject a withdrawal with the status enum'
);

insert into tap_results (result)
select ok(
  (
    select status = 'rejected' and refunded_at is not null
    from public.currency_withdrawals
    where user_id = '30000000-0000-4000-8000-000000000001'
    order by created_at desc
    limit 1
  ),
  'rejected withdrawals record their refund'
);

insert into tap_results (result)
select is(
  (
    select balance
    from public.user_currency_balances
    where user_id = '30000000-0000-4000-8000-000000000001'
      and currency_code = 'USD'
  ),
  100::numeric,
  'rejecting a withdrawal restores the reserved funds'
);

update public.currency_withdrawals
set reviewed_at = '2026-07-15 09:30:00+00'
where user_id = '30000000-0000-4000-8000-000000000001'
  and amount = 25;

insert into tap_results (result)
select ok(
  (
    select
      created_at = reviewed_at
      and updated_at = reviewed_at
      and refunded_at = reviewed_at
    from public.currency_withdrawals
    where user_id = '30000000-0000-4000-8000-000000000001'
      and amount = 25
  ),
  'backdating reviewed_at synchronizes displayed, updated, and refund dates'
);

insert into tap_results (result)
select ok(
  (
    select submitted_at <> reviewed_at
    from public.currency_withdrawals
    where user_id = '30000000-0000-4000-8000-000000000001'
      and amount = 25
  ),
  'backdating preserves the original submission timestamp'
);

set local role authenticated;

insert into tap_results (result)
select lives_ok(
  $$
    select public.request_currency_withdrawal(
      p_currency_code => 'USD',
      p_amount => 30,
      p_account_holder_name => 'Currency Test',
      p_bank_name => 'Test Bank',
      p_beneficiary_address => '1 Main Street, Lagos',
      p_account_number => '1234567890',
      p_account_type => 'checking',
      p_routing_number => '021000021'
    )
  $$,
  'a second valid withdrawal can be submitted'
);

reset role;

insert into tap_results (result)
select lives_ok(
  format(
    'update public.currency_withdrawals set status = %L where id = %L::uuid',
    'approved',
    (
      select id
      from public.currency_withdrawals
      where user_id = '30000000-0000-4000-8000-000000000001'
        and status = 'pending'
      order by created_at desc
      limit 1
    )
  ),
  'an administrator can approve a withdrawal with the status enum'
);

insert into tap_results (result)
select is(
  (
    select status::text
    from public.currency_withdrawals
    where user_id = '30000000-0000-4000-8000-000000000001'
      and amount = 30
    order by created_at desc
    limit 1
  ),
  'approved',
  'approved withdrawals are finalized'
);

insert into tap_results (result)
select is(
  (
    select balance
    from public.user_currency_balances
    where user_id = '30000000-0000-4000-8000-000000000001'
      and currency_code = 'USD'
  ),
  70::numeric,
  'approving a withdrawal does not deduct the reserved funds twice'
);

insert into tap_results (result)
select * from finish();

select result
from tap_results;

rollback;
