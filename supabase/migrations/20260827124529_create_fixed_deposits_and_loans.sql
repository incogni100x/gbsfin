create type public.fixed_deposit_status_enum as enum (
  'active',
  'pending_closure',
  'processing',
  'completed',
  'rejected',
  'closed'
);

create type public.loan_status_enum as enum (
  'pending',
  'approved',
  'rejected',
  'active',
  'completed'
);

create table public.fixed_deposit_rates (
  id smallint generated always as identity primary key,
  duration_months integer not null unique,
  monthly_rate numeric(5, 2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint fixed_deposit_rates_duration_positive check (duration_months > 0),
  constraint fixed_deposit_rates_rate_positive check (monthly_rate > 0)
);

insert into public.fixed_deposit_rates (id, duration_months, monthly_rate)
overriding system value
values
  (1, 3, 13.50),
  (2, 6, 12.50),
  (3, 12, 10.00),
  (4, 24, 8.50),
  (5, 60, 8.00),
  (6, 120, 7.50);

select setval(
  pg_get_serial_sequence('public.fixed_deposit_rates', 'id'),
  (select max(id) from public.fixed_deposit_rates)
);

create table public.fixed_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid not null references public.user_accounts (id) on delete cascade,
  rate_id smallint not null references public.fixed_deposit_rates (id),
  amount numeric(20, 2) not null,
  duration_months integer not null,
  monthly_rate numeric(5, 2) not null,
  status public.fixed_deposit_status_enum not null default 'active',
  start_date date not null default current_date,
  end_date date not null,
  closure_requested_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  penalty_amount numeric(20, 2) not null default 0,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixed_deposits_amount_positive check (amount > 0),
  constraint fixed_deposits_duration_positive check (duration_months > 0),
  constraint fixed_deposits_rate_positive check (monthly_rate > 0),
  constraint fixed_deposits_dates_valid check (end_date > start_date),
  constraint fixed_deposits_penalty_nonnegative check (penalty_amount >= 0)
);

create index fixed_deposits_user_created_at_idx
  on public.fixed_deposits (user_id, created_at desc);
create index fixed_deposits_account_id_idx
  on public.fixed_deposits (account_id);
create index fixed_deposits_status_end_date_idx
  on public.fixed_deposits (status, end_date);
create index fixed_deposits_rate_id_idx
  on public.fixed_deposits (rate_id);
create index fixed_deposits_approved_by_idx
  on public.fixed_deposits (approved_by)
  where approved_by is not null;

create table public.fixed_deposit_profits (
  id uuid primary key default gen_random_uuid(),
  fixed_deposit_id uuid not null references public.fixed_deposits (id) on delete cascade,
  profit_amount numeric(20, 6) not null,
  earned_on date not null,
  finalized boolean not null default false,
  created_at timestamptz not null default now(),
  unique (fixed_deposit_id, earned_on),
  constraint fixed_deposit_profits_amount_nonnegative check (profit_amount >= 0)
);

create index fixed_deposit_profits_deposit_finalized_idx
  on public.fixed_deposit_profits (fixed_deposit_id, finalized);

create table public.loan_types (
  id smallint generated always as identity primary key,
  name text not null unique,
  description text not null,
  is_investment boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.loan_types (id, name, description, is_investment)
overriding system value
values
  (1, 'Fast Loan', 'Short-term financing for urgent needs.', false),
  (2, 'Personal Loan', 'Standard personal financing for medium- to long-term use.', false),
  (3, 'Investment Loan', 'Special financing available to approved investment partners.', true);

select setval(
  pg_get_serial_sequence('public.loan_types', 'id'),
  (select max(id) from public.loan_types)
);

create table public.loan_plans (
  id smallint generated always as identity primary key,
  duration_months integer not null unique,
  annual_interest_rate numeric(5, 2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint loan_plans_duration_positive check (duration_months > 0),
  constraint loan_plans_interest_positive check (annual_interest_rate > 0)
);

insert into public.loan_plans (id, duration_months, annual_interest_rate)
overriding system value
values
  (1, 6, 6.50),
  (2, 12, 5.80),
  (3, 24, 4.50),
  (4, 60, 3.40),
  (5, 120, 2.10);

select setval(
  pg_get_serial_sequence('public.loan_plans', 'id'),
  (select max(id) from public.loan_plans)
);

create table public.loan_purposes (
  id smallint generated always as identity primary key,
  label text not null unique,
  is_active boolean not null default true,
  display_order smallint not null
);

insert into public.loan_purposes (id, label, display_order)
overriding system value
values
  (1, 'Emergency expenses', 1),
  (2, 'Home improvement', 2),
  (3, 'Education', 3),
  (4, 'Medical expenses', 4),
  (5, 'Vehicle purchase', 5),
  (6, 'Debt consolidation', 6),
  (7, 'Business expenses', 7),
  (8, 'Other', 8);

select setval(
  pg_get_serial_sequence('public.loan_purposes', 'id'),
  (select max(id) from public.loan_purposes)
);

create table public.investment_loan_partners (
  id smallint generated always as identity primary key,
  name text not null unique,
  is_active boolean not null default true,
  display_order smallint not null
);

insert into public.investment_loan_partners (id, name, display_order)
overriding system value
values
  (1, 'Coinbase', 1),
  (2, 'CapiRocket', 2),
  (3, 'EliteMutual Fund', 3),
  (4, 'Apex Capital', 4),
  (5, 'Global Growth Fund', 5),
  (6, 'Northstar Investments', 6);

select setval(
  pg_get_serial_sequence('public.investment_loan_partners', 'id'),
  (select max(id) from public.investment_loan_partners)
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid not null references public.user_accounts (id) on delete cascade,
  loan_type_id smallint not null references public.loan_types (id),
  plan_id smallint not null references public.loan_plans (id),
  amount numeric(20, 2) not null,
  reason text not null,
  status public.loan_status_enum not null default 'pending',
  annual_interest_rate numeric(5, 2) not null,
  duration_months integer not null,
  monthly_payment numeric(20, 2) not null,
  remaining_balance numeric(20, 2) not null,
  remaining_months integer not null,
  next_due_date date,
  overdue_count integer not null default 0,
  is_overdue boolean not null default false,
  overdue_amount numeric(20, 2) not null default 0,
  reviewed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loans_amount_positive check (amount > 0),
  constraint loans_monthly_payment_positive check (monthly_payment > 0),
  constraint loans_remaining_balance_nonnegative check (remaining_balance >= 0),
  constraint loans_remaining_months_nonnegative check (remaining_months >= 0),
  constraint loans_overdue_nonnegative check (
    overdue_count >= 0 and overdue_amount >= 0
  )
);

create index loans_user_created_at_idx on public.loans (user_id, created_at desc);
create index loans_account_id_idx on public.loans (account_id);
create index loans_type_id_idx on public.loans (loan_type_id);
create index loans_plan_id_idx on public.loans (plan_id);
create index loans_status_due_date_idx on public.loans (status, next_due_date);
create index loans_approved_by_idx on public.loans (approved_by)
  where approved_by is not null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid references public.user_accounts (id) on delete set null,
  type text not null,
  direction text not null,
  amount numeric(20, 2) not null,
  currency_code text not null default 'USD',
  status text not null default 'completed',
  note text,
  fixed_deposit_id uuid references public.fixed_deposits (id) on delete set null,
  loan_id uuid references public.loans (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_direction_check check (direction in ('debit', 'credit')),
  constraint transactions_status_check check (status = 'completed'),
  constraint transactions_type_check check (
    type in (
      'fixed_deposit_funding',
      'fixed_deposit_payout',
      'loan_disbursement',
      'loan_repayment'
    )
  )
);

create index transactions_user_created_at_idx
  on public.transactions (user_id, created_at desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_fixed_deposit_id_idx on public.transactions (fixed_deposit_id)
  where fixed_deposit_id is not null;
create index transactions_loan_id_idx on public.transactions (loan_id)
  where loan_id is not null;

create trigger fixed_deposits_set_updated_at
before update on public.fixed_deposits
for each row execute function private.set_updated_at();

create trigger loans_set_updated_at
before update on public.loans
for each row execute function private.set_updated_at();

create or replace function public.open_fixed_deposit(
  p_account_id uuid,
  p_rate_id smallint,
  p_amount numeric
)
returns public.fixed_deposits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account public.user_accounts;
  v_rate public.fixed_deposit_rates;
  v_deposit public.fixed_deposits;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a valid deposit amount with no more than two decimal places';
  end if;

  select account.*
  into v_account
  from public.user_accounts as account
  where account.id = p_account_id
    and account.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Funding account was not found';
  end if;

  if v_account.currency_code <> 'USD' then
    raise exception 'Fixed deposits can only be funded from USD bank accounts';
  end if;

  if v_account.balance < p_amount then
    raise exception 'Insufficient account balance';
  end if;

  select rate.*
  into v_rate
  from public.fixed_deposit_rates as rate
  where rate.id = p_rate_id
    and rate.is_active;

  if not found then
    raise exception 'The selected fixed-deposit term is unavailable';
  end if;

  update public.user_accounts
  set balance = balance - p_amount
  where id = v_account.id;

  insert into public.fixed_deposits (
    user_id,
    account_id,
    rate_id,
    amount,
    duration_months,
    monthly_rate,
    end_date
  )
  values (
    v_user_id,
    v_account.id,
    v_rate.id,
    p_amount,
    v_rate.duration_months,
    v_rate.monthly_rate,
    current_date + make_interval(months => v_rate.duration_months)
  )
  returning * into v_deposit;

  insert into public.transactions (
    user_id, account_id, type, direction, amount, note, fixed_deposit_id
  )
  values (
    v_user_id,
    v_account.id,
    'fixed_deposit_funding',
    'debit',
    p_amount,
    format('%s-month fixed deposit opened', v_rate.duration_months),
    v_deposit.id
  );

  return v_deposit;
end;
$$;

create or replace function public.request_fixed_deposit_closure(
  p_fixed_deposit_id uuid
)
returns public.fixed_deposits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_deposit public.fixed_deposits;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  update public.fixed_deposits
  set
    status = 'pending_closure',
    closure_requested_at = now()
  where id = p_fixed_deposit_id
    and user_id = v_user_id
    and status in ('active', 'rejected')
    and current_date < end_date
  returning * into v_deposit;

  if not found then
    raise exception 'This fixed deposit cannot be closed early';
  end if;

  return v_deposit;
end;
$$;

create or replace function private.handle_fixed_deposit_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_profit numeric(20, 6);
  v_penalty numeric(20, 2);
  v_payout numeric(20, 2);
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if old.status = 'closed' then
      raise exception 'A closed fixed deposit cannot be paid again';
    end if;

    select coalesce(sum(profit.profit_amount), 0)
    into v_total_profit
    from public.fixed_deposit_profits as profit
    where profit.fixed_deposit_id = new.id
      and not profit.finalized;

    v_penalty := case
      when current_date < new.end_date then round(v_total_profit * 0.055, 2)
      else 0
    end;
    v_payout := round(new.amount + v_total_profit - v_penalty, 2);

    update public.user_accounts
    set balance = balance + v_payout
    where id = new.account_id
      and user_id = new.user_id;

    if not found then
      raise exception 'The payout account was not found';
    end if;

    update public.fixed_deposit_profits
    set finalized = true
    where fixed_deposit_id = new.id
      and not finalized;

    insert into public.transactions (
      user_id, account_id, type, direction, amount, note, fixed_deposit_id
    )
    values (
      new.user_id,
      new.account_id,
      'fixed_deposit_payout',
      'credit',
      v_payout,
      case
        when v_penalty > 0 then 'Early fixed-deposit closure payout'
        else 'Fixed-deposit maturity payout'
      end,
      new.id
    );

    new.penalty_amount = v_penalty;
    new.approved_at = now();
    new.approved_by = auth.uid();
    new.closed_at = now();
    new.status = 'closed';
  end if;

  return new;
end;
$$;

create trigger fixed_deposits_handle_closure
before update of status on public.fixed_deposits
for each row execute function private.handle_fixed_deposit_closure();

create or replace function public.process_daily_fixed_deposits(
  p_as_of_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deposit public.fixed_deposits;
  v_day date;
  v_expected_profit numeric(20, 6);
  v_existing_profit numeric(20, 6);
  v_daily_profit numeric(20, 6);
  v_term_days integer;
  v_accrual_count integer := 0;
  v_closed_count integer := 0;
begin
  for v_deposit in
    select deposit.*
    from public.fixed_deposits as deposit
    where deposit.status in ('active', 'pending_closure', 'processing', 'rejected')
      and deposit.start_date <= p_as_of_date
    order by deposit.id
    for update
  loop
    v_expected_profit := round(
      v_deposit.amount * (v_deposit.monthly_rate / 100) * v_deposit.duration_months,
      6
    );
    v_term_days := v_deposit.end_date - v_deposit.start_date;

    for v_day in
      select day::date
      from generate_series(
        v_deposit.start_date,
        least(p_as_of_date, v_deposit.end_date)::timestamp,
        interval '1 day'
      ) as day
      where day::date > v_deposit.start_date
      order by day
    loop
      if not exists (
        select 1
        from public.fixed_deposit_profits as profit
        where profit.fixed_deposit_id = v_deposit.id
          and profit.earned_on = v_day
      ) then
        select coalesce(sum(profit.profit_amount), 0)
        into v_existing_profit
        from public.fixed_deposit_profits as profit
        where profit.fixed_deposit_id = v_deposit.id;

        v_daily_profit := case
          when v_day = v_deposit.end_date
            then greatest(v_expected_profit - v_existing_profit, 0)
          else round(v_expected_profit / v_term_days, 6)
        end;

        insert into public.fixed_deposit_profits (
          fixed_deposit_id, profit_amount, earned_on
        )
        values (v_deposit.id, v_daily_profit, v_day)
        on conflict (fixed_deposit_id, earned_on) do nothing;

        if found then
          v_accrual_count := v_accrual_count + 1;
        end if;
      end if;
    end loop;

    if p_as_of_date >= v_deposit.end_date then
      update public.fixed_deposits
      set status = 'completed'
      where id = v_deposit.id
        and status in ('active', 'pending_closure', 'processing', 'rejected');
      v_closed_count := v_closed_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'accruals_created', v_accrual_count,
    'deposits_closed', v_closed_count,
    'processed_through', p_as_of_date
  );
end;
$$;

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
  where plan.id = p_plan_id
    and plan.is_active;

  if not found then
    raise exception 'The selected loan plan is unavailable';
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

create or replace function private.handle_loan_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    update public.user_accounts
    set balance = balance + new.amount
    where id = new.account_id
      and user_id = new.user_id;

    if not found then
      raise exception 'The loan credit account was not found';
    end if;

    insert into public.transactions (
      user_id, account_id, type, direction, amount, note, loan_id
    )
    values (
      new.user_id,
      new.account_id,
      'loan_disbursement',
      'credit',
      new.amount,
      'Approved loan disbursement',
      new.id
    );

    new.reviewed_at = now();
    new.approved_at = now();
    new.approved_by = auth.uid();
    new.next_due_date = current_date + interval '1 month';
    new.status = 'active';
  elsif new.status = 'rejected' and old.status = 'pending' then
    new.reviewed_at = now();
  elsif new.status is distinct from old.status
    and old.status <> 'active'
    and not (old.status = 'pending' and new.status in ('approved', 'rejected'))
  then
    raise exception 'Invalid loan status transition';
  end if;

  return new;
end;
$$;

create trigger loans_handle_review
before update of status on public.loans
for each row execute function private.handle_loan_review();

create or replace function public.process_due_loan_payments(
  p_as_of_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans;
  v_payment numeric(20, 2);
  v_monthly_rate numeric;
  v_interest_portion numeric(20, 2);
  v_principal_portion numeric(20, 2);
  v_paid_count integer := 0;
  v_overdue_count integer := 0;
begin
  for v_loan in
    select loan.*
    from public.loans as loan
    where loan.status = 'active'
      and loan.next_due_date <= p_as_of_date
    order by loan.id
    for update
  loop
    v_payment := least(
      v_loan.monthly_payment,
      round(
        v_loan.remaining_balance
          + (v_loan.remaining_balance * (v_loan.annual_interest_rate / 100) / 12),
        2
      )
    );

    update public.user_accounts
    set balance = balance - v_payment
    where id = v_loan.account_id
      and user_id = v_loan.user_id
      and balance >= v_payment;

    if found then
      v_monthly_rate := (v_loan.annual_interest_rate / 100) / 12;
      v_interest_portion := round(v_loan.remaining_balance * v_monthly_rate, 2);
      v_principal_portion := greatest(v_payment - v_interest_portion, 0);

      insert into public.transactions (
        user_id, account_id, type, direction, amount, note, loan_id
      )
      values (
        v_loan.user_id,
        v_loan.account_id,
        'loan_repayment',
        'debit',
        v_payment,
        'Automated monthly loan payment',
        v_loan.id
      );

      update public.loans
      set
        remaining_balance = greatest(remaining_balance - v_principal_portion, 0),
        remaining_months = greatest(remaining_months - 1, 0),
        next_due_date = (next_due_date + interval '1 month')::date,
        overdue_count = 0,
        is_overdue = false,
        overdue_amount = 0,
        status = case
          when remaining_months <= 1
            or remaining_balance - v_principal_portion <= 0
            then 'completed'::public.loan_status_enum
          else status
        end,
        completed_at = case
          when remaining_months <= 1
            or remaining_balance - v_principal_portion <= 0
            then now()
          else completed_at
        end
      where id = v_loan.id;

      v_paid_count := v_paid_count + 1;
    else
      update public.loans
      set
        next_due_date = (next_due_date + interval '1 month')::date,
        overdue_count = overdue_count + 1,
        is_overdue = true,
        overdue_amount = overdue_amount + v_payment
      where id = v_loan.id;

      v_overdue_count := v_overdue_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'payments_processed', v_paid_count,
    'payments_overdue', v_overdue_count,
    'processed_through', p_as_of_date
  );
end;
$$;

alter table public.fixed_deposit_rates enable row level security;
alter table public.fixed_deposits enable row level security;
alter table public.fixed_deposit_profits enable row level security;
alter table public.loan_types enable row level security;
alter table public.loan_plans enable row level security;
alter table public.loan_purposes enable row level security;
alter table public.investment_loan_partners enable row level security;
alter table public.loans enable row level security;
alter table public.transactions enable row level security;

create policy fixed_deposit_rates_authenticated_read
on public.fixed_deposit_rates for select to authenticated using (is_active);

create policy fixed_deposits_owner_read
on public.fixed_deposits for select to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

create policy fixed_deposit_profits_owner_read
on public.fixed_deposit_profits for select to authenticated
using (
  exists (
    select 1
    from public.fixed_deposits as deposit
    where deposit.id = fixed_deposit_profits.fixed_deposit_id
      and deposit.user_id = (select auth.uid())
  )
  and (select public.is_current_session_verified())
);

create policy loan_types_authenticated_read
on public.loan_types for select to authenticated using (is_active);
create policy loan_plans_authenticated_read
on public.loan_plans for select to authenticated using (is_active);
create policy loan_purposes_authenticated_read
on public.loan_purposes for select to authenticated using (is_active);
create policy investment_loan_partners_authenticated_read
on public.investment_loan_partners for select to authenticated using (is_active);

create policy loans_owner_read
on public.loans for select to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

create policy transactions_owner_read
on public.transactions for select to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

revoke all on
  public.fixed_deposit_rates,
  public.fixed_deposits,
  public.fixed_deposit_profits,
  public.loan_types,
  public.loan_plans,
  public.loan_purposes,
  public.investment_loan_partners,
  public.loans,
  public.transactions
from public, anon, authenticated;

grant select on
  public.fixed_deposit_rates,
  public.fixed_deposits,
  public.fixed_deposit_profits,
  public.loan_types,
  public.loan_plans,
  public.loan_purposes,
  public.investment_loan_partners,
  public.loans,
  public.transactions
to authenticated;

grant select on
  public.fixed_deposit_rates,
  public.fixed_deposits,
  public.fixed_deposit_profits,
  public.loan_types,
  public.loan_plans,
  public.loan_purposes,
  public.investment_loan_partners,
  public.loans,
  public.transactions
to service_role;

revoke all on function public.open_fixed_deposit(uuid, smallint, numeric)
from public, anon;
grant execute on function public.open_fixed_deposit(uuid, smallint, numeric)
to authenticated;

revoke all on function public.request_fixed_deposit_closure(uuid)
from public, anon;
grant execute on function public.request_fixed_deposit_closure(uuid)
to authenticated;

revoke all on function public.request_loan(uuid, smallint, smallint, numeric, text)
from public, anon;
grant execute on function public.request_loan(uuid, smallint, smallint, numeric, text)
to authenticated;

revoke all on function public.process_daily_fixed_deposits(date)
from public, anon, authenticated;
grant execute on function public.process_daily_fixed_deposits(date)
to service_role;

revoke all on function public.process_due_loan_payments(date)
from public, anon, authenticated;
grant execute on function public.process_due_loan_payments(date)
to service_role;

revoke all on function private.handle_fixed_deposit_closure()
from public, anon, authenticated;
revoke all on function private.handle_loan_review()
from public, anon, authenticated;
