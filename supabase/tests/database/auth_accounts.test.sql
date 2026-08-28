begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table('public', 'account_types', 'account_types exists');
select has_table('public', 'security_questions', 'security_questions exists');
select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'user_accounts', 'user_accounts exists');
select has_table(
  'public',
  'user_security_answers',
  'user_security_answers exists'
);

select is(
  (select count(*)::integer from public.account_types),
  5,
  'all five account types are installed'
);

select is(
  (select count(*)::integer from public.security_questions),
  9,
  'all nine security questions are installed'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.account_types'::regclass),
  'account_types has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.security_questions'::regclass),
  'security_questions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'profiles has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_accounts'::regclass),
  'user_accounts has RLS enabled'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.user_security_answers'::regclass
  ),
  'user_security_answers has RLS enabled'
);

select has_function(
  'public',
  'open_account',
  array['smallint', 'text'],
  'open_account RPC exists'
);
select has_function(
  'public',
  'set_security_answers',
  array['jsonb'],
  'set_security_answers RPC exists'
);
select has_function(
  'public',
  'verify_security_answer',
  array['text', 'text'],
  'verify_security_answer RPC exists'
);

select * from finish();

rollback;
