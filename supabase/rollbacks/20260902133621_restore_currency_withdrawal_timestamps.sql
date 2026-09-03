-- Manual rollback for migration 20260902133621.
-- Run only after explicit approval and coordinate it with the matching app rollback.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.currency_withdrawals
  add column submitted_at timestamptz,
  add column reviewed_at timestamptz,
  add column refunded_at timestamptz,
  add column updated_at timestamptz;

update public.currency_withdrawals as withdrawal
set
  submitted_at = archive.submitted_at,
  reviewed_at = archive.reviewed_at,
  refunded_at = archive.refunded_at,
  updated_at = archive.updated_at
from private.currency_withdrawal_legacy_timestamps as archive
where archive.currency_withdrawal_id = withdrawal.id;

-- Supply compatible values for withdrawals created after the forward migration
-- and reconcile archived timestamps with any subsequent status changes.
update public.currency_withdrawals
set
  submitted_at = coalesce(submitted_at, created_at),
  reviewed_at = case
    when status = 'pending' then null
    else coalesce(reviewed_at, created_at)
  end,
  refunded_at = case
    when status = 'rejected' then coalesce(refunded_at, reviewed_at, created_at)
    else null
  end,
  updated_at = coalesce(updated_at, created_at);

alter table public.currency_withdrawals
  alter column submitted_at set default now(),
  alter column submitted_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

comment on column public.currency_withdrawals.submitted_at is
  'Immutable original submission timestamp. Review-date backdating does not overwrite it.';

alter table public.currency_withdrawals
  add constraint currency_withdrawals_review_state_check check (
    (status = 'pending' and reviewed_at is null and refunded_at is null)
    or (status = 'approved' and reviewed_at is not null and refunded_at is null)
    or (status = 'rejected' and reviewed_at is not null and refunded_at is not null)
  );

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

  if new.submitted_at is distinct from old.submitted_at then
    raise exception 'The original submission timestamp cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'pending' then
      raise exception 'A reviewed withdrawal cannot return to pending';
    end if;

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

    new.reviewed_at = coalesce(new.reviewed_at, now());
    new.refunded_at = case
      when new.status = 'rejected'
        then coalesce(new.refunded_at, new.reviewed_at)
      else null
    end;
  end if;

  if new.reviewed_at is distinct from old.reviewed_at then
    if new.status = 'pending' then
      raise exception 'A pending withdrawal cannot have a review date';
    end if;

    new.created_at = new.reviewed_at;
    new.updated_at = new.reviewed_at;

    if new.status = 'rejected' then
      new.refunded_at = new.reviewed_at;
    end if;
  elsif new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function private.handle_currency_withdrawal_review()
  from public, anon, authenticated;

create trigger currency_withdrawals_review
before update on public.currency_withdrawals
for each row execute function private.handle_currency_withdrawal_review();

drop table private.currency_withdrawal_legacy_timestamps;

commit;
