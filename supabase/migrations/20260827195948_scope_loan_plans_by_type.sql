update public.loan_types
set
  name = 'Mortgage',
  description = 'Long-term financing for a residential property.'
where id = 2
  and name = 'Personal Loan';

alter table public.loan_plans
drop constraint if exists loan_plans_duration_months_key;

alter table public.loan_plans
add constraint loan_plans_duration_rate_key
unique (duration_months, annual_interest_rate);

insert into public.loan_plans (duration_months, annual_interest_rate)
values
  (24, 5.70),
  (60, 5.86),
  (120, 6.01),
  (180, 6.10),
  (360, 6.80),
  (12, 0.32)
on conflict (duration_months, annual_interest_rate) do nothing;

create table public.loan_type_plans (
  loan_type_id smallint not null
    references public.loan_types (id) on delete restrict,
  plan_id smallint not null
    references public.loan_plans (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (loan_type_id, plan_id)
);

create index loan_type_plans_plan_id_idx
on public.loan_type_plans (plan_id);

with eligible_plans (loan_type_name, duration_months, annual_interest_rate) as (
  values
    ('Fast Loan', 6, 6.50::numeric),
    ('Fast Loan', 12, 5.80::numeric),
    ('Fast Loan', 24, 4.50::numeric),
    ('Fast Loan', 60, 3.40::numeric),
    ('Fast Loan', 120, 2.10::numeric),
    ('Mortgage', 24, 5.70::numeric),
    ('Mortgage', 60, 5.86::numeric),
    ('Mortgage', 120, 6.01::numeric),
    ('Mortgage', 180, 6.10::numeric),
    ('Mortgage', 360, 6.80::numeric),
    ('Investment Loan', 12, 0.32::numeric)
)
insert into public.loan_type_plans (loan_type_id, plan_id)
select loan_type.id, plan.id
from eligible_plans as eligible
join public.loan_types as loan_type
  on loan_type.name = eligible.loan_type_name
join public.loan_plans as plan
  on plan.duration_months = eligible.duration_months
  and plan.annual_interest_rate = eligible.annual_interest_rate
on conflict (loan_type_id, plan_id) do nothing;

alter table public.loan_type_plans enable row level security;

create policy loan_type_plans_authenticated_read
on public.loan_type_plans
for select
to authenticated
using (
  exists (
    select 1
    from public.loan_types as loan_type
    join public.loan_plans as plan on plan.id = loan_type_plans.plan_id
    where loan_type.id = loan_type_plans.loan_type_id
      and loan_type.is_active
      and plan.is_active
  )
);

revoke all on public.loan_type_plans from public, anon, authenticated;
grant select on public.loan_type_plans to authenticated, service_role;

create or replace function public.request_loan(
  p_account_id uuid,
  p_loan_type_id smallint,
  p_plan_id smallint,
  p_amount numeric,
  p_reason text
)
returns public.loans
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.user_accounts;
  v_type public.loan_types;
  v_plan public.loan_plans;
  v_monthly_rate numeric;
  v_monthly_payment numeric(20, 2);
  v_loan public.loans;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a valid loan amount with no more than two decimal places';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Select a loan purpose';
  end if;

  select account.*
  into v_account
  from public.user_accounts as account
  where account.id = p_account_id
    and account.user_id = v_user_id;

  if not found or v_account.currency_code <> 'USD' then
    raise exception 'Select a valid USD account to credit';
  end if;

  select loan_type.*
  into v_type
  from public.loan_types as loan_type
  where loan_type.id = p_loan_type_id
    and loan_type.is_active;

  if not found then
    raise exception 'The selected loan type is unavailable';
  end if;

  select plan.*
  into v_plan
  from public.loan_plans as plan
  join public.loan_type_plans as eligibility
    on eligibility.plan_id = plan.id
  where plan.id = p_plan_id
    and eligibility.loan_type_id = v_type.id
    and plan.is_active;

  if not found then
    raise exception 'The selected loan plan is unavailable for this loan type';
  end if;

  if v_type.is_investment and not exists (
    select 1
    from public.investment_loan_partners as partner
    where partner.name = btrim(p_reason)
      and partner.is_active
  ) then
    raise exception 'Select an approved investment partner';
  end if;

  if not v_type.is_investment and not exists (
    select 1
    from public.loan_purposes as purpose
    where purpose.label = btrim(p_reason)
      and purpose.is_active
  ) then
    raise exception 'Select a valid loan purpose';
  end if;

  v_monthly_rate := (v_plan.annual_interest_rate / 100) / 12;
  v_monthly_payment := round(
    p_amount * v_monthly_rate * power(1 + v_monthly_rate, v_plan.duration_months)
      / (power(1 + v_monthly_rate, v_plan.duration_months) - 1),
    2
  );

  insert into public.loans (
    user_id,
    account_id,
    loan_type_id,
    plan_id,
    amount,
    reason,
    annual_interest_rate,
    duration_months,
    monthly_payment,
    remaining_balance,
    remaining_months
  )
  values (
    v_user_id,
    v_account.id,
    v_type.id,
    v_plan.id,
    p_amount,
    btrim(p_reason),
    v_plan.annual_interest_rate,
    v_plan.duration_months,
    v_monthly_payment,
    p_amount,
    v_plan.duration_months
  )
  returning * into v_loan;

  return v_loan;
end;
$$;

revoke all on function public.request_loan(uuid, smallint, smallint, numeric, text)
from public, anon;
grant execute on function public.request_loan(uuid, smallint, smallint, numeric, text)
to authenticated;
