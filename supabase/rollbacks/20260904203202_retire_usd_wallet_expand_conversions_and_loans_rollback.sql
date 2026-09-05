begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

update public.currencies
set is_active = true
where code = 'USD';

update public.deposit_instructions
set is_active = true
where currency_code = 'USD';

drop function if exists public.convert_currency_balance(
  text, numeric, text, text, uuid
);

alter function public.convert_currency_balance_before_usd_retirement(
  text, numeric, text
) rename to convert_currency_balance;

grant execute on function public.convert_currency_balance(text, numeric, text)
  to authenticated, service_role;

-- New conversion rows may already point from a non-USD wallet to a USD bank
-- account. Keep the expanded check on rollback so those financial records stay
-- valid; restoring the prior RPC is sufficient to stop creating new ones.

delete from public.loan_type_plans as eligibility
using public.loan_types as loan_type
where eligibility.loan_type_id = loan_type.id
  and loan_type.name in (
    'Home Equity Line of Credit (HELOC)',
    'SBA Loans',
    'Commercial Real Estate',
    'Lines of Credit'
  );

update public.loan_types
set is_active = false
where name in (
  'Home Equity Line of Credit (HELOC)',
  'SBA Loans',
  'Commercial Real Estate',
  'Lines of Credit'
);

delete from public.loan_types as loan_type
where loan_type.name in (
    'Home Equity Line of Credit (HELOC)',
    'SBA Loans',
    'Commercial Real Estate',
    'Lines of Credit'
  )
  and not exists (
    select 1 from public.loans as loan where loan.loan_type_id = loan_type.id
  );

delete from public.loan_plans as plan
where (plan.duration_months, plan.annual_interest_rate) in (
    (24, 4.95), (60, 5.10), (120, 5.25),
    (24, 4.25), (60, 4.50), (120, 4.75),
    (24, 5.15), (60, 5.30), (120, 5.45), (180, 5.55),
    (12, 3.25), (24, 3.75), (60, 4.10)
  )
  and not exists (
    select 1 from public.loan_type_plans as eligibility
    where eligibility.plan_id = plan.id
  )
  and not exists (
    select 1 from public.loans as loan where loan.plan_id = plan.id
  );

commit;
