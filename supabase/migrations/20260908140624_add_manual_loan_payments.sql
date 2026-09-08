begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  loan_id uuid not null references public.loans (id) on delete cascade,
  source_account_id uuid references public.user_accounts (id) on delete set null,
  payment_kind text not null,
  payment_amount numeric(20, 2) not null,
  loan_currency_code text not null default 'USD',
  source_debit_amount numeric(20, 2) not null,
  source_currency_code text not null,
  exchange_rate numeric(24, 12) not null default 1,
  overdue_applied numeric(20, 2) not null default 0,
  interest_applied numeric(20, 2) not null default 0,
  principal_applied numeric(20, 2) not null default 0,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  constraint loan_payments_kind_check
    check (payment_kind in ('manual', 'scheduled')),
  constraint loan_payments_amount_positive
    check (payment_amount > 0 and source_debit_amount > 0),
  constraint loan_payments_currency_check
    check (
      loan_currency_code = upper(loan_currency_code)
      and source_currency_code = upper(source_currency_code)
      and loan_currency_code ~ '^[A-Z]{3,4}$'
      and source_currency_code ~ '^[A-Z]{3,4}$'
    ),
  constraint loan_payments_rate_positive check (exchange_rate > 0),
  constraint loan_payments_allocations_nonnegative check (
    overdue_applied >= 0
    and interest_applied >= 0
    and principal_applied >= 0
  ),
  constraint loan_payments_allocations_match check (
    payment_amount = overdue_applied + interest_applied + principal_applied
  ),
  constraint loan_payments_manual_idempotency_check check (
    (payment_kind = 'manual' and idempotency_key is not null)
    or (payment_kind = 'scheduled' and idempotency_key is null)
  )
);

create index loan_payments_user_created_at_idx
  on public.loan_payments (user_id, created_at desc);

create index loan_payments_loan_created_at_idx
  on public.loan_payments (loan_id, created_at desc);

create unique index loan_payments_user_idempotency_idx
  on public.loan_payments (user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.loan_payments enable row level security;

create policy loan_payments_owner_read
on public.loan_payments for select to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

revoke all on public.loan_payments from public, anon, authenticated;
grant select on public.loan_payments to authenticated, service_role;

create function public.make_loan_payment(
  p_loan_id uuid,
  p_source_account_id uuid,
  p_amount numeric,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_loan public.loans;
  v_account public.user_accounts;
  v_existing public.loan_payments;
  v_source_rate numeric(24, 12) := 1;
  v_source_debit numeric(20, 2);
  v_total_due numeric(20, 2);
  v_overdue_applied numeric(20, 2);
  v_principal_applied numeric(20, 2);
  v_new_overdue numeric(20, 2);
  v_new_balance numeric(20, 2);
  v_new_monthly_payment numeric(20, 2);
  v_monthly_rate numeric;
  v_payment public.loan_payments;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if p_idempotency_key is null then
    raise exception 'A payment reference is required';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a valid payment amount with no more than two decimal places';
  end if;

  select loan.*
  into v_loan
  from public.loans as loan
  where loan.id = p_loan_id
    and loan.user_id = v_user_id
  for update;

  if not found then
    raise exception 'The selected loan was not found';
  end if;

  if v_loan.status <> 'active' then
    raise exception 'Only active loans can receive payments';
  end if;

  select account.*
  into v_account
  from public.user_accounts as account
  join public.currencies as currency
    on currency.code = account.currency_code
  where account.id = p_source_account_id
    and account.user_id = v_user_id
    and currency.currency_kind = 'fiat'
    and currency.is_active
  for update of account;

  if not found then
    raise exception 'Select a valid bank account';
  end if;

  select payment.*
  into v_existing
  from public.loan_payments as payment
  where payment.user_id = v_user_id
    and payment.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.loan_id <> p_loan_id
      or v_existing.source_account_id is distinct from p_source_account_id
      or v_existing.payment_amount <> p_amount
    then
      raise exception 'This payment reference has already been used';
    end if;

    return jsonb_build_object(
      'payment_id', v_existing.id,
      'loan_id', v_existing.loan_id,
      'payment_amount', v_existing.payment_amount,
      'source_debit_amount', v_existing.source_debit_amount,
      'source_currency_code', v_existing.source_currency_code,
      'exchange_rate', v_existing.exchange_rate,
      'overdue_applied', v_existing.overdue_applied,
      'principal_applied', v_existing.principal_applied,
      'remaining_balance', v_loan.remaining_balance,
      'overdue_amount', v_loan.overdue_amount,
      'monthly_payment', v_loan.monthly_payment,
      'status', v_loan.status,
      'already_processed', true
    );
  end if;

  v_total_due := round(v_loan.remaining_balance + v_loan.overdue_amount, 2);
  if p_amount > v_total_due then
    raise exception 'Payment cannot exceed the total due of %', v_total_due;
  end if;

  if v_account.currency_code <> 'USD' then
    select rate.rate
    into v_source_rate
    from public.exchange_rates as rate
    where rate.base_currency_code = 'USD'
      and rate.quote_currency_code = v_account.currency_code;

    if v_source_rate is null then
      raise exception 'An exchange rate is unavailable for this account';
    end if;
  end if;

  v_source_debit := round(p_amount * v_source_rate, 2);
  if v_source_debit <= 0 then
    raise exception 'The payment amount is too small';
  end if;

  if v_account.balance < v_source_debit then
    raise exception 'Insufficient % balance', v_account.currency_code;
  end if;

  v_overdue_applied := least(p_amount, v_loan.overdue_amount);
  v_principal_applied := least(
    greatest(p_amount - v_overdue_applied, 0),
    v_loan.remaining_balance
  );
  v_new_overdue := greatest(v_loan.overdue_amount - v_overdue_applied, 0);
  v_new_balance := greatest(v_loan.remaining_balance - v_principal_applied, 0);
  v_new_monthly_payment := v_loan.monthly_payment;

  if v_new_balance > 0 and v_principal_applied > 0 then
    if v_loan.remaining_months > 0 and v_loan.annual_interest_rate > 0 then
      v_monthly_rate := (v_loan.annual_interest_rate / 100) / 12;
      v_new_monthly_payment := greatest(
        round(
          v_new_balance * v_monthly_rate
            * power(1 + v_monthly_rate, v_loan.remaining_months)
            / (power(1 + v_monthly_rate, v_loan.remaining_months) - 1),
          2
        ),
        0.01
      );
    else
      v_new_monthly_payment := greatest(
        round(v_new_balance / greatest(v_loan.remaining_months, 1), 2),
        0.01
      );
    end if;
  end if;

  update public.user_accounts
  set balance = balance - v_source_debit
  where id = v_account.id;

  insert into public.loan_payments (
    user_id,
    loan_id,
    source_account_id,
    payment_kind,
    payment_amount,
    source_debit_amount,
    source_currency_code,
    exchange_rate,
    overdue_applied,
    principal_applied,
    idempotency_key
  ) values (
    v_user_id,
    v_loan.id,
    v_account.id,
    'manual',
    p_amount,
    v_source_debit,
    v_account.currency_code,
    v_source_rate,
    v_overdue_applied,
    v_principal_applied,
    p_idempotency_key
  ) returning * into v_payment;

  insert into public.transactions (
    user_id,
    account_id,
    type,
    direction,
    amount,
    currency_code,
    note,
    loan_id
  ) values (
    v_user_id,
    v_account.id,
    'loan_repayment',
    'debit',
    v_source_debit,
    v_account.currency_code,
    format('Manual loan payment; USD %s applied', p_amount),
    v_loan.id
  );

  update public.loans
  set
    remaining_balance = v_new_balance,
    overdue_amount = v_new_overdue,
    overdue_count = case when v_new_overdue = 0 then 0 else overdue_count end,
    is_overdue = v_new_overdue > 0,
    monthly_payment = v_new_monthly_payment,
    remaining_months = case
      when v_new_balance = 0 and v_new_overdue = 0 then 0
      else remaining_months
    end,
    next_due_date = case
      when v_new_balance = 0 and v_new_overdue = 0 then null
      else next_due_date
    end,
    status = case
      when v_new_balance = 0 and v_new_overdue = 0
        then 'completed'::public.loan_status_enum
      else status
    end,
    completed_at = case
      when v_new_balance = 0 and v_new_overdue = 0 then now()
      else completed_at
    end
  where id = v_loan.id;

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'loan_id', v_loan.id,
    'payment_amount', v_payment.payment_amount,
    'source_debit_amount', v_payment.source_debit_amount,
    'source_currency_code', v_payment.source_currency_code,
    'exchange_rate', v_payment.exchange_rate,
    'overdue_applied', v_payment.overdue_applied,
    'principal_applied', v_payment.principal_applied,
    'remaining_balance', v_new_balance,
    'overdue_amount', v_new_overdue,
    'monthly_payment', v_new_monthly_payment,
    'status', case
      when v_new_balance = 0 and v_new_overdue = 0 then 'completed'
      else v_loan.status::text
    end,
    'already_processed', false
  );
end;
$$;

revoke all on function public.make_loan_payment(uuid, uuid, numeric, uuid)
from public, anon;
grant execute on function public.make_loan_payment(uuid, uuid, numeric, uuid)
to authenticated, service_role;

comment on function public.make_loan_payment(uuid, uuid, numeric, uuid)
is 'Atomically applies a verified user loan payment, debits the selected fiat bank account, and records an idempotent ledger entry.';

alter function public.process_due_loan_payments(date)
  rename to process_due_loan_payments_before_manual_ledger;

revoke all on function public.process_due_loan_payments_before_manual_ledger(date)
from public, anon, authenticated, service_role;

create function public.process_due_loan_payments(
  p_as_of_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loan public.loans;
  v_account public.user_accounts;
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

    select account.*
    into v_account
    from public.user_accounts as account
    where account.id = v_loan.account_id
      and account.user_id = v_loan.user_id
    for update;

    if found and v_account.currency_code = 'USD' and v_account.balance >= v_payment then
      v_monthly_rate := (v_loan.annual_interest_rate / 100) / 12;
      v_interest_portion := least(
        round(v_loan.remaining_balance * v_monthly_rate, 2),
        v_payment
      );
      v_principal_portion := greatest(v_payment - v_interest_portion, 0);

      update public.user_accounts
      set balance = balance - v_payment
      where id = v_account.id;

      insert into public.loan_payments (
        user_id,
        loan_id,
        source_account_id,
        payment_kind,
        payment_amount,
        source_debit_amount,
        source_currency_code,
        exchange_rate,
        interest_applied,
        principal_applied
      ) values (
        v_loan.user_id,
        v_loan.id,
        v_account.id,
        'scheduled',
        v_payment,
        v_payment,
        'USD',
        1,
        v_interest_portion,
        v_principal_portion
      );

      insert into public.transactions (
        user_id, account_id, type, direction, amount, currency_code, note, loan_id
      ) values (
        v_loan.user_id,
        v_account.id,
        'loan_repayment',
        'debit',
        v_payment,
        'USD',
        'Automated monthly loan payment',
        v_loan.id
      );

      update public.loans
      set
        remaining_balance = greatest(remaining_balance - v_principal_portion, 0),
        remaining_months = greatest(remaining_months - 1, 0),
        next_due_date = case
          when remaining_months <= 1
            or remaining_balance - v_principal_portion <= 0
            then null
          else (next_due_date + interval '1 month')::date
        end,
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

revoke all on function public.process_due_loan_payments(date)
from public, anon, authenticated;
grant execute on function public.process_due_loan_payments(date)
to service_role;

commit;
