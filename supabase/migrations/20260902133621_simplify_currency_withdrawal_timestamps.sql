begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Preserve every removed value and the status it described. The archive stays
-- private and can restore rows even if their status changes after migration.
create table private.currency_withdrawal_legacy_timestamps (
  currency_withdrawal_id uuid primary key
    references public.currency_withdrawals (id) on delete cascade,
  archived_status public.request_status not null,
  submitted_at timestamptz not null,
  reviewed_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz not null,
  archived_at timestamptz not null default now()
);

revoke all on table private.currency_withdrawal_legacy_timestamps
  from public, anon, authenticated;

insert into private.currency_withdrawal_legacy_timestamps (
  currency_withdrawal_id,
  archived_status,
  submitted_at,
  reviewed_at,
  refunded_at,
  updated_at
)
select
  id,
  status,
  submitted_at,
  reviewed_at,
  refunded_at,
  updated_at
from public.currency_withdrawals;

alter table public.currency_withdrawals
  drop constraint currency_withdrawals_review_state_check;

drop trigger currency_withdrawals_review
  on public.currency_withdrawals;

create or replace function private.handle_currency_withdrawal_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance_update_count integer;
begin
  if new.user_id is distinct from old.user_id
    or new.currency_code is distinct from old.currency_code
    or new.amount is distinct from old.amount
  then
    raise exception 'A withdrawal owner, currency, and amount cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'pending' then
      raise exception 'A reviewed withdrawal cannot return to pending';
    end if;

    -- Funds are reserved when the request is created. Moving into rejected
    -- refunds once; moving from rejected to approved reserves them again.
    if new.status = 'rejected' and old.status <> 'rejected' then
      update public.user_currency_balances
      set balance = balance + new.amount
      where user_id = new.user_id
        and currency_code = new.currency_code;

      if not found then
        raise exception 'The reserved currency balance could not be refunded';
      end if;
    elsif new.status = 'approved' and old.status = 'rejected' then
      update public.user_currency_balances
      set balance = balance - new.amount
      where user_id = new.user_id
        and currency_code = new.currency_code
        and balance >= new.amount;

      get diagnostics v_balance_update_count = row_count;

      if v_balance_update_count <> 1 then
        raise exception 'The withdrawal cannot be approved because the refunded balance is insufficient';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_currency_withdrawal_review()
  from public, anon, authenticated;

create trigger currency_withdrawals_review
before update on public.currency_withdrawals
for each row execute function private.handle_currency_withdrawal_review();

alter table public.currency_withdrawals
  drop column submitted_at,
  drop column reviewed_at,
  drop column refunded_at,
  drop column updated_at;

commit;
