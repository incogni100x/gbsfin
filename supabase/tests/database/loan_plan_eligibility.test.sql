begin;

create extension if not exists pgtap with schema extensions;

select plan(15);

select has_table(
  'public',
  'loan_type_plans',
  'loan plan eligibility mapping exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.loan_type_plans'::regclass),
  'loan plan eligibility has RLS enabled'
);

select policies_are(
  'public',
  'loan_type_plans',
  array['loan_type_plans_authenticated_read'],
  'authenticated users can read active loan plan eligibility'
);

select is(
  (select name from public.loan_types where id = 2),
  'Mortgage',
  'the second loan type is Mortgage'
);

select is(
  (
    select count(*)::integer
    from public.loan_type_plans as eligibility
    join public.loan_types as loan_type on loan_type.id = eligibility.loan_type_id
    where loan_type.name = 'Fast Loan'
  ),
  5,
  'Fast Loan has five eligible plans'
);

select is(
  (
    select count(*)::integer
    from public.loan_type_plans as eligibility
    join public.loan_types as loan_type on loan_type.id = eligibility.loan_type_id
    where loan_type.name = 'Mortgage'
  ),
  5,
  'Mortgage has five eligible plans'
);

select is(
  (
    select count(*)::integer
    from public.loan_type_plans as eligibility
    join public.loan_types as loan_type on loan_type.id = eligibility.loan_type_id
    where loan_type.name = 'Investment Loan'
  ),
  1,
  'Investment Loan has one eligible plan'
);

select ok(
  exists (
    select 1
    from public.loan_type_plans as eligibility
    join public.loan_types as loan_type on loan_type.id = eligibility.loan_type_id
    join public.loan_plans as plan on plan.id = eligibility.plan_id
    where loan_type.name = 'Investment Loan'
      and plan.duration_months = 12
      and plan.annual_interest_rate = 0.32
  ),
  'Investment Loan uses the 12 month 0.32 percent plan'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.request_loan(uuid,smallint,smallint,numeric,text)',
    'EXECUTE'
  ),
  'authenticated users can request a valid loan through the RPC'
);

select is(
  (select count(*)::integer from public.loan_types where name in (
    'Home Equity Line of Credit (HELOC)', 'SBA Loans',
    'Commercial Real Estate', 'Lines of Credit'
  ) and is_active),
  4,
  'all four new loan products are active'
);

select is(
  (select count(*)::integer from public.loan_type_plans eligibility
   join public.loan_types loan_type on loan_type.id = eligibility.loan_type_id
   where loan_type.name = 'Home Equity Line of Credit (HELOC)'),
  3,
  'HELOC has three plans'
);

select is(
  (select count(*)::integer from public.loan_type_plans eligibility
   join public.loan_types loan_type on loan_type.id = eligibility.loan_type_id
   where loan_type.name = 'SBA Loans'),
  3,
  'SBA Loans has three plans'
);

select is(
  (select count(*)::integer from public.loan_type_plans eligibility
   join public.loan_types loan_type on loan_type.id = eligibility.loan_type_id
   where loan_type.name = 'Commercial Real Estate'),
  4,
  'Commercial Real Estate has four plans'
);

select is(
  (select count(*)::integer from public.loan_type_plans eligibility
   join public.loan_types loan_type on loan_type.id = eligibility.loan_type_id
   where loan_type.name = 'Lines of Credit'),
  3,
  'Lines of Credit has three plans'
);

select ok(
  not exists (
    select 1
    from public.loan_type_plans eligibility
    join public.loan_types loan_type on loan_type.id = eligibility.loan_type_id
    join public.loan_plans plan on plan.id = eligibility.plan_id
    where loan_type.name in (
      'Home Equity Line of Credit (HELOC)', 'SBA Loans',
      'Commercial Real Estate', 'Lines of Credit'
    ) and plan.annual_interest_rate >= 5.70
  ),
  'new product rates remain below the mortgage rate floor'
);

select * from finish();

rollback;
