create table public.currency_transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_currency_code text not null references public.currencies (code),
  destination_type text not null,
  destination_currency_code text not null references public.currencies (code),
  destination_account_id uuid references public.user_accounts (id) on delete restrict,
  source_amount numeric(24, 6) not null,
  exchange_rate numeric(24, 12) not null,
  destination_amount numeric(24, 6) not null,
  status text not null default 'completed',
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint currency_transfers_source_amount_positive
    check (source_amount > 0),
  constraint currency_transfers_destination_amount_positive
    check (destination_amount > 0),
  constraint currency_transfers_exchange_rate_positive
    check (exchange_rate > 0),
  constraint currency_transfers_status_check
    check (status = 'completed'),
  constraint currency_transfers_destination_check check (
    (
      destination_type = 'currency_balance'
      and destination_account_id is null
      and source_currency_code <> destination_currency_code
    )
    or (
      destination_type = 'bank_account'
      and destination_account_id is not null
      and source_currency_code = 'USD'
      and destination_currency_code = 'USD'
      and exchange_rate = 1
    )
  )
);

create index currency_transfers_user_created_at_idx
  on public.currency_transfers (user_id, created_at desc);

create index currency_transfers_source_currency_code_idx
  on public.currency_transfers (source_currency_code);

create index currency_transfers_destination_currency_code_idx
  on public.currency_transfers (destination_currency_code);

create index currency_transfers_destination_account_id_idx
  on public.currency_transfers (destination_account_id)
  where destination_account_id is not null;

alter table public.currency_transfers enable row level security;

create policy currency_transfers_owner_read
on public.currency_transfers
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

grant select on public.currency_transfers to authenticated;
grant select on public.currency_transfers to service_role;

revoke insert, update, delete on public.currency_transfers from authenticated;

create or replace function public.transfer_currency_balance(
  p_source_currency_code text,
  p_amount numeric,
  p_destination_type text,
  p_destination_currency_code text default null,
  p_destination_account_id uuid default null
)
returns public.currency_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_currency_code text := upper(btrim(p_source_currency_code));
  v_destination_type text := lower(btrim(p_destination_type));
  v_destination_currency_code text := upper(btrim(p_destination_currency_code));
  v_source_balance numeric(24, 6);
  v_source_usd_rate numeric(24, 12);
  v_destination_usd_rate numeric(24, 12);
  v_exchange_rate numeric(24, 12);
  v_destination_amount numeric(24, 6);
  v_locked_balance_count integer;
  v_destination_account_currency text;
  v_transfer public.currency_transfers;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Transfer amount must be greater than zero';
  end if;

  if p_amount <> round(p_amount, 6) then
    raise exception 'Transfer amount cannot have more than six decimal places';
  end if;

  if v_destination_type not in ('currency_balance', 'bank_account') then
    raise exception 'Invalid transfer destination';
  end if;

  if v_destination_type = 'bank_account' then
    if v_source_currency_code <> 'USD' then
      raise exception 'Only USD currency balances can transfer to bank accounts';
    end if;

    if p_destination_account_id is null then
      raise exception 'Select a destination bank account';
    end if;

    if p_amount <> round(p_amount, 2) then
      raise exception 'Bank transfer amounts cannot have more than two decimal places';
    end if;

    select balance.balance
    into v_source_balance
    from public.user_currency_balances as balance
    where balance.user_id = v_user_id
      and balance.currency_code = 'USD'
    for update;

    if not found then
      raise exception 'USD currency balance is not enabled';
    end if;

    select account.currency_code
    into v_destination_account_currency
    from public.user_accounts as account
    where account.id = p_destination_account_id
      and account.user_id = v_user_id
    for update;

    if not found then
      raise exception 'Destination bank account was not found';
    end if;

    if v_destination_account_currency <> 'USD' then
      raise exception 'Currency balances can only fund USD bank accounts';
    end if;

    if v_source_balance < p_amount then
      raise exception 'Insufficient USD balance';
    end if;

    v_destination_currency_code := 'USD';
    v_exchange_rate := 1;
    v_destination_amount := round(p_amount, 2);

    update public.user_currency_balances
    set balance = balance - p_amount
    where user_id = v_user_id
      and currency_code = 'USD';

    update public.user_accounts
    set balance = balance + v_destination_amount
    where id = p_destination_account_id
      and user_id = v_user_id;
  else
    if v_destination_currency_code is null
      or v_destination_currency_code = ''
    then
      raise exception 'Select a destination currency';
    end if;

    if v_source_currency_code = v_destination_currency_code then
      raise exception 'Source and destination currencies must be different';
    end if;

    perform 1
    from public.user_currency_balances as balance
    where balance.user_id = v_user_id
      and balance.currency_code in (
        v_source_currency_code,
        v_destination_currency_code
      )
    order by balance.currency_code
    for update;

    get diagnostics v_locked_balance_count = row_count;

    if v_locked_balance_count <> 2 then
      raise exception 'Both currency balances must be enabled before transferring';
    end if;

    select balance.balance
    into v_source_balance
    from public.user_currency_balances as balance
    where balance.user_id = v_user_id
      and balance.currency_code = v_source_currency_code;

    if v_source_balance < p_amount then
      raise exception 'Insufficient % balance', v_source_currency_code;
    end if;

    select
      max(rate.rate) filter (
        where rate.quote_currency_code = v_source_currency_code
      ),
      max(rate.rate) filter (
        where rate.quote_currency_code = v_destination_currency_code
      )
    into v_source_usd_rate, v_destination_usd_rate
    from public.exchange_rates as rate
    where rate.base_currency_code = 'USD'
      and rate.quote_currency_code in (
        v_source_currency_code,
        v_destination_currency_code
      );

    if v_source_usd_rate is null or v_destination_usd_rate is null then
      raise exception 'An exchange rate is unavailable for this transfer';
    end if;

    v_exchange_rate := round(
      v_destination_usd_rate / v_source_usd_rate,
      12
    );
    v_destination_amount := round(p_amount * v_exchange_rate, 6);

    if v_destination_amount <= 0 then
      raise exception 'The converted amount is too small to transfer';
    end if;

    update public.user_currency_balances
    set balance = case currency_code
      when v_source_currency_code then balance - p_amount
      when v_destination_currency_code then balance + v_destination_amount
    end
    where user_id = v_user_id
      and currency_code in (
        v_source_currency_code,
        v_destination_currency_code
      );
  end if;

  insert into public.currency_transfers (
    user_id,
    source_currency_code,
    destination_type,
    destination_currency_code,
    destination_account_id,
    source_amount,
    exchange_rate,
    destination_amount
  )
  values (
    v_user_id,
    v_source_currency_code,
    v_destination_type,
    v_destination_currency_code,
    case
      when v_destination_type = 'bank_account'
        then p_destination_account_id
      else null
    end,
    p_amount,
    v_exchange_rate,
    v_destination_amount
  )
  returning * into v_transfer;

  return v_transfer;
end;
$$;

revoke all on function public.transfer_currency_balance(
  text,
  numeric,
  text,
  text,
  uuid
) from public, anon;

grant execute on function public.transfer_currency_balance(
  text,
  numeric,
  text,
  text,
  uuid
) to authenticated;
