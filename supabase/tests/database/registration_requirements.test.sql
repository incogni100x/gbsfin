begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  result text not null
) on commit drop;

grant select, insert on tap_results to authenticated;

insert into tap_results (result)
select plan(16);

insert into tap_results (result)
select has_table(
  'private',
  'referral_codes',
  'private referral codes table exists'
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
  '30000000-0000-4000-8000-000000000002',
  'referral-owner@example.invalid',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Referral","last_name":"Owner"}'::jsonb,
  false,
  false
);

update public.profiles
set referral_code = 'test-referral'
where id = '30000000-0000-4000-8000-000000000002';

update private.referral_codes
set max_uses = 1
where code = 'TEST-REFERRAL';

insert into tap_results (result)
select is(
  (
    select referral_code
    from public.profiles
    where id = '30000000-0000-4000-8000-000000000002'
  ),
  'TEST-REFERRAL',
  'an admin-created profile referral code is normalized and registered'
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
  'registration-requirements@example.invalid',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"first_name":"Registration","last_name":"Test"}'::jsonb,
  false,
  false
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '30000000-0000-4000-8000-000000000001',
    'session_id', '40000000-0000-4000-8000-000000000001'
  )::text,
  true
);

set local role authenticated;

insert into tap_results (result)
select is(
  public.validate_referral_code(''),
  true,
  'a blank optional referral code is accepted'
);

insert into tap_results (result)
select is(
  public.validate_referral_code('not-valid'),
  false,
  'an unknown referral code is rejected'
);

insert into tap_results (result)
select is(
  public.validate_referral_code('test-referral'),
  true,
  'a valid referral code is normalized and accepted'
);

insert into tap_results (result)
select throws_like(
  $$
    select public.set_security_answers(
      '[
        {"question_id":"favorite_color","answer":"indigo"},
        {"question_id":"favorite_food","answer":"jollof"}
      ]'::jsonb
    )
  $$,
  '%Exactly three distinct security questions are required%',
  'fewer than three security questions cannot be saved'
);

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
  'three distinct security questions can be saved'
);

insert into tap_results (result)
select throws_like(
  $$select * from public.open_accounts(array[1, 2], 'USD')$$,
  '%Exactly three distinct account types are required%',
  'fewer than three account types cannot be opened'
);

insert into tap_results (result)
select throws_like(
  $$select * from public.open_accounts(array[1, 3, 4], 'USD')$$,
  '%Checking must be included%',
  'three account types without Checking cannot be opened'
);

insert into tap_results (result)
select lives_ok(
  $$select * from public.open_accounts(array[1, 2, 4], 'USD')$$,
  'exactly three distinct account types can be opened atomically'
);

insert into tap_results (result)
select is(
  (
    select count(*)::integer
    from public.user_accounts
    where user_id = '30000000-0000-4000-8000-000000000001'
  ),
  3,
  'exactly three accounts were created'
);

insert into tap_results (result)
select lives_ok(
  $$select public.apply_referral_code('test-referral')$$,
  'a valid referral code can be applied'
);

insert into tap_results (result)
select is(
  (
    select referred_by_code
    from public.profiles
    where id = '30000000-0000-4000-8000-000000000001'
  ),
  'TEST-REFERRAL',
  'the normalized code is stored as the referring code'
);

insert into tap_results (result)
select lives_ok(
  $$select public.apply_referral_code('TEST-REFERRAL')$$,
  'reapplying the same referral code is idempotent'
);

reset role;

insert into tap_results (result)
select is(
  (
    select use_count
    from private.referral_codes
    where code = 'TEST-REFERRAL'
  ),
  1,
  'an idempotent retry does not consume the referral code twice'
);

set local role authenticated;

insert into tap_results (result)
select is(
  public.validate_referral_code('TEST-REFERRAL'),
  false,
  'a referral code at its use limit is no longer available'
);

insert into tap_results (result)
select * from finish();

select result
from tap_results;

rollback;
