alter table public.currency_transfers
add column source_account_id uuid
references public.user_accounts (id) on delete cascade;

create index currency_transfers_source_account_id_idx
on public.currency_transfers (source_account_id)
where source_account_id is not null;

alter table public.currency_transfers
drop constraint currency_transfers_destination_check;

alter table public.currency_transfers
add constraint currency_transfers_destination_check check (
  (
    destination_type = 'currency_balance'
    and source_account_id is null
    and destination_account_id is null
    and source_currency_code <> destination_currency_code
  )
  or (
    destination_type = 'bank_account'
    and source_account_id is null
    and destination_account_id is not null
    and source_currency_code = 'USD'
    and destination_currency_code = 'USD'
    and exchange_rate = 1
  )
  or (
    destination_type = 'currency_balance_from_bank'
    and source_account_id is not null
    and destination_account_id is null
    and source_currency_code = 'USD'
    and destination_currency_code = 'USD'
    and exchange_rate = 1
  )
);

create or replace function public.transfer_bank_account_to_usd_balance(
  p_source_account_id uuid,
  p_amount numeric
)
returns public.currency_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_account_balance numeric(20, 2);
  v_account_currency text;
  v_transfer public.currency_transfers;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'Enter a valid amount with no more than two decimal places';
  end if;

  -- Match the reverse-transfer RPC's lock order: currency balance, then account.
  perform 1
  from public.user_currency_balances as balance
  where balance.user_id = v_user_id
    and balance.currency_code = 'USD'
  for update;

  if not found then
    raise exception 'USD currency balance is not enabled';
  end if;

  select account.balance, account.currency_code
  into v_account_balance, v_account_currency
  from public.user_accounts as account
  where account.id = p_source_account_id
    and account.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Source bank account was not found';
  end if;

  if v_account_currency <> 'USD' then
    raise exception 'Only USD bank accounts can fund the USD currency balance';
  end if;

  if v_account_balance < p_amount then
    raise exception 'Insufficient bank account balance';
  end if;

  update public.user_accounts
  set balance = balance - p_amount
  where id = p_source_account_id
    and user_id = v_user_id;

  update public.user_currency_balances
  set balance = balance + p_amount
  where user_id = v_user_id
    and currency_code = 'USD';

  insert into public.currency_transfers (
    user_id,
    source_currency_code,
    source_account_id,
    destination_type,
    destination_currency_code,
    destination_account_id,
    source_amount,
    exchange_rate,
    destination_amount
  )
  values (
    v_user_id,
    'USD',
    p_source_account_id,
    'currency_balance_from_bank',
    'USD',
    null,
    p_amount,
    1,
    p_amount
  )
  returning * into v_transfer;

  return v_transfer;
end;
$$;

revoke all on function public.transfer_bank_account_to_usd_balance(uuid, numeric)
from public, anon;

grant execute on function public.transfer_bank_account_to_usd_balance(uuid, numeric)
to authenticated;
