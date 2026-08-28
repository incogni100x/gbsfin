begin;

create extension if not exists pgtap with schema extensions;

create temporary table tap_results (
  result text not null
) on commit drop;

grant select, insert on tap_results to authenticated;

insert into tap_results (result)
select plan(5);

insert into tap_results (result)
select has_function(
  'public',
  'submit_onboarding',
  array[]::text[],
  'submit onboarding RPC exists'
);

insert into auth.users (
  id,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  is_sso_user,
  is_anonymous
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    'profile-owner@example.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Profile","last_name":"Owner"}'::jsonb,
    false,
    false
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    'different-profile@example.invalid',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"first_name":"Different","last_name":"Profile"}'::jsonb,
    false,
    false
  );

update public.profiles
set onboarding_status = 'approved'
where id = '50000000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claims',
  json_build_object(
    'role', 'authenticated',
    'sub', '50000000-0000-4000-8000-000000000001',
    'session_id', '60000000-0000-4000-8000-000000000001'
  )::text,
  true
);

set local role authenticated;

insert into tap_results (result)
select lives_ok(
  $$
    update public.profiles
    set first_name = 'Updated', phone_number = '+2348000000000'
    where id = '50000000-0000-4000-8000-000000000001'
  $$,
  'an approved user can update their editable profile fields'
);

insert into tap_results (result)
select is(
  (
    select first_name
    from public.profiles
    where id = '50000000-0000-4000-8000-000000000001'
  ),
  'Updated',
  'the owner profile update is persisted'
);

update public.profiles
set first_name = 'Blocked'
where id = '50000000-0000-4000-8000-000000000002';

reset role;

insert into tap_results (result)
select is(
  (
    select first_name
    from public.profiles
    where id = '50000000-0000-4000-8000-000000000002'
  ),
  'Different',
  'a user cannot update another profile'
);

set local role authenticated;

insert into tap_results (result)
select throws_like(
  $$
    update public.profiles
    set onboarding_status = 'approved'
    where id = '50000000-0000-4000-8000-000000000001'
  $$,
  '%permission denied%',
  'a user cannot directly change onboarding status'
);

insert into tap_results (result)
select * from finish();

select result
from tap_results;

rollback;
