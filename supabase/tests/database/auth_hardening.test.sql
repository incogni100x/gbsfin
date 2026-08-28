begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  result text not null
) on commit drop;

grant select, insert on tap_results to authenticated;

insert into tap_results (result)
select plan(9);

insert into tap_results (result)
select has_table(
  'private',
  'security_answer_attempts',
  'security answer attempts table exists'
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
  '10000000-0000-4000-8000-000000000001',
  'auth-hardening-test@example.invalid',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Auth","last_name":"Test"}'::jsonb,
  false,
  false
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '10000000-0000-4000-8000-000000000001',
    'session_id', '20000000-0000-4000-8000-000000000001'
  )::text,
  true
);

set local role authenticated;

insert into tap_results (result)
select lives_ok(
  $$
    select public.set_security_answers(
      '[
        {"question_id":"favorite_color","answer":"indigo"},
        {"question_id":"favorite_food","answer":"jollof"},
        {"question_id":"birth_city","answer":"lagos"}
      ]'::jsonb
    )
  $$,
  'initial security answers can be set during onboarding'
);

insert into tap_results (result)
select is(
  public.is_current_session_verified(),
  true,
  'setting initial answers verifies the onboarding session'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '10000000-0000-4000-8000-000000000001',
    'session_id', '20000000-0000-4000-8000-000000000002'
  )::text,
  true
);

insert into tap_results (result)
select is(
  public.verify_security_answer('favorite_color', null),
  false,
  'a null security answer never verifies a session'
);

insert into tap_results (result)
select throws_like(
  $$select public.open_account(1::smallint, 'USD')$$,
  '%verified session is required%',
  'an unverified session cannot open an account'
);

insert into tap_results (result)
select throws_like(
  $$
    select public.set_security_answers(
      '[
        {"question_id":"favorite_color","answer":"changed"},
        {"question_id":"favorite_food","answer":"changed"},
        {"question_id":"birth_city","answer":"changed"}
      ]'::jsonb
    )
  $$,
  '%verified session is required%',
  'an unverified session cannot replace existing answers'
);

insert into tap_results (result)
select is(
  public.verify_security_answer('favorite_color', 'indigo'),
  true,
  'a correct security answer verifies the current session'
);

insert into tap_results (result)
select lives_ok(
  $$select public.open_account(1::smallint, 'USD')$$,
  'a verified session can open an account'
);

insert into tap_results (result)
select is(
  (select count(*)::integer from public.user_accounts),
  1,
  'the verified account opening creates one account'
);

insert into tap_results (result)
select * from finish();

select result
from tap_results;

rollback;
