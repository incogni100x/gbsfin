create table public.currency_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  currency_code text not null references public.currencies (code),
  amount numeric(24, 6) not null,
  status public.request_status not null default 'pending',
  account_holder_name text,
  bank_name text,
  bank_address text,
  beneficiary_address text,
  account_number text,
  account_type text,
  routing_number text,
  iban text,
  swift_bic text,
  sort_code text,
  bsb text,
  clabe text,
  wallet_address text,
  network text,
  review_note text,
  reviewed_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint currency_withdrawals_amount_positive check (amount > 0),
  constraint currency_withdrawals_review_state_check check (
    (status = 'pending' and reviewed_at is null and refunded_at is null)
    or (status = 'approved' and reviewed_at is not null and refunded_at is null)
    or (status = 'rejected' and reviewed_at is not null and refunded_at is not null)
  )
);

create index currency_withdrawals_user_created_at_idx
  on public.currency_withdrawals (user_id, created_at desc);

create index currency_withdrawals_pending_created_at_idx
  on public.currency_withdrawals (created_at)
  where status = 'pending';

create index currency_withdrawals_currency_code_idx
  on public.currency_withdrawals (currency_code);

create trigger currency_withdrawals_set_updated_at
before update on public.currency_withdrawals
for each row execute function private.set_updated_at();

alter table public.currency_withdrawals enable row level security;

create policy currency_withdrawals_owner_read
on public.currency_withdrawals
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

revoke all on public.currency_withdrawals from public, anon, authenticated;
grant select on public.currency_withdrawals to authenticated;
grant select on public.currency_withdrawals to service_role;

create or replace function public.request_currency_withdrawal(
  p_currency_code text,
  p_amount numeric,
  p_account_holder_name text default null,
  p_bank_name text default null,
  p_bank_address text default null,
  p_beneficiary_address text default null,
  p_account_number text default null,
  p_account_type text default null,
  p_routing_number text default null,
  p_iban text default null,
  p_swift_bic text default null,
  p_sort_code text default null,
  p_bsb text default null,
  p_clabe text default null,
  p_wallet_address text default null,
  p_network text default null
)
returns public.currency_withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency_code text := upper(btrim(p_currency_code));
  v_balance numeric(24, 6);
  v_withdrawal public.currency_withdrawals;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Withdrawal amount must be greater than zero';
  end if;

  if p_amount <> round(p_amount, 6) then
    raise exception 'Withdrawal amount cannot have more than six decimal places';
  end if;

  if v_currency_code in ('USD', 'EUR', 'AUD', 'AED', 'MXN', 'GBP', 'NZD')
    and (
      nullif(btrim(p_account_holder_name), '') is null
      or nullif(btrim(p_bank_name), '') is null
      or nullif(btrim(p_beneficiary_address), '') is null
    )
  then
    raise exception 'Account holder, bank name, and beneficiary address are required';
  end if;

  case v_currency_code
    when 'USD' then
      if nullif(btrim(p_account_number), '') is null
        or nullif(btrim(p_routing_number), '') is null
        or lower(btrim(p_account_type)) not in ('checking', 'savings')
      then
        raise exception 'USD withdrawals require an account number, routing number, and account type';
      end if;
    when 'EUR' then
      if nullif(btrim(p_iban), '') is null
        or nullif(btrim(p_swift_bic), '') is null
      then
        raise exception 'EUR withdrawals require an IBAN and SWIFT/BIC';
      end if;
    when 'AUD' then
      if nullif(btrim(p_account_number), '') is null
        or nullif(btrim(p_bsb), '') is null
      then
        raise exception 'AUD withdrawals require an account number and BSB';
      end if;
    when 'AED' then
      if nullif(btrim(p_iban), '') is null
        or nullif(btrim(p_swift_bic), '') is null
      then
        raise exception 'AED withdrawals require an IBAN and SWIFT/BIC';
      end if;
    when 'MXN' then
      if nullif(btrim(p_clabe), '') is null then
        raise exception 'MXN withdrawals require a CLABE';
      end if;
    when 'GBP' then
      if nullif(btrim(p_account_number), '') is null
        or nullif(btrim(p_sort_code), '') is null
      then
        raise exception 'GBP withdrawals require an account number and sort code';
      end if;
    when 'NZD' then
      if nullif(btrim(p_account_number), '') is null then
        raise exception 'NZD withdrawals require a New Zealand account number';
      end if;
    when 'USDC' then
      if nullif(btrim(p_wallet_address), '') is null
        or btrim(p_network) <> 'Ethereum (ERC20)'
      then
        raise exception 'USDC withdrawals require an Ethereum (ERC20) wallet';
      end if;
    when 'USDT' then
      if nullif(btrim(p_wallet_address), '') is null
        or btrim(p_network) <> 'Tron (TRC20)'
      then
        raise exception 'USDT withdrawals require a Tron (TRC20) wallet';
      end if;
    else
      raise exception 'This currency cannot be withdrawn';
  end case;

  select balance.balance
  into v_balance
  from public.user_currency_balances as balance
  where balance.user_id = v_user_id
    and balance.currency_code = v_currency_code
  for update;

  if not found then
    raise exception 'This currency balance is not enabled';
  end if;

  if v_balance < p_amount then
    raise exception 'Insufficient % balance', v_currency_code;
  end if;

  update public.user_currency_balances
  set balance = balance - p_amount
  where user_id = v_user_id
    and currency_code = v_currency_code;

  insert into public.currency_withdrawals (
    user_id,
    currency_code,
    amount,
    account_holder_name,
    bank_name,
    bank_address,
    beneficiary_address,
    account_number,
    account_type,
    routing_number,
    iban,
    swift_bic,
    sort_code,
    bsb,
    clabe,
    wallet_address,
    network
  )
  values (
    v_user_id,
    v_currency_code,
    p_amount,
    nullif(btrim(p_account_holder_name), ''),
    nullif(btrim(p_bank_name), ''),
    nullif(btrim(p_bank_address), ''),
    nullif(btrim(p_beneficiary_address), ''),
    nullif(btrim(p_account_number), ''),
    nullif(lower(btrim(p_account_type)), ''),
    nullif(btrim(p_routing_number), ''),
    nullif(upper(btrim(p_iban)), ''),
    nullif(upper(btrim(p_swift_bic)), ''),
    nullif(btrim(p_sort_code), ''),
    nullif(btrim(p_bsb), ''),
    nullif(btrim(p_clabe), ''),
    nullif(btrim(p_wallet_address), ''),
    nullif(btrim(p_network), '')
  )
  returning * into v_withdrawal;

  return v_withdrawal;
end;
$$;

revoke all on function public.request_currency_withdrawal(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) from public, anon;

grant execute on function public.request_currency_withdrawal(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.review_currency_withdrawal(
  p_withdrawal_id uuid,
  p_status text,
  p_review_note text default null
)
returns public.currency_withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := lower(btrim(p_status));
  v_withdrawal public.currency_withdrawals;
begin
  if v_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected';
  end if;

  select withdrawal.*
  into v_withdrawal
  from public.currency_withdrawals as withdrawal
  where withdrawal.id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'Withdrawal request was not found';
  end if;

  if v_withdrawal.status <> 'pending' then
    raise exception 'Only pending withdrawal requests can be reviewed';
  end if;

  if v_status = 'rejected' then
    update public.user_currency_balances
    set balance = balance + v_withdrawal.amount
    where user_id = v_withdrawal.user_id
      and currency_code = v_withdrawal.currency_code;

    if not found then
      raise exception 'The reserved currency balance could not be refunded';
    end if;
  end if;

  update public.currency_withdrawals
  set
    status = v_status::public.request_status,
    review_note = nullif(btrim(p_review_note), ''),
    reviewed_at = now(),
    refunded_at = case when v_status = 'rejected' then now() else null end
  where id = p_withdrawal_id
  returning * into v_withdrawal;

  return v_withdrawal;
end;
$$;

revoke all on function public.review_currency_withdrawal(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_currency_withdrawal(uuid, text, text)
  to service_role;
