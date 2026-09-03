-- Manual rollback for migration 20260902125442.
-- Run only after explicit approval and coordinate it with the matching app rollback.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.deposit_confirmations
  add column reviewed_at timestamptz,
  add column credited_at timestamptz,
  add column updated_at timestamptz;

-- Restore rows that existed before the forward migration from the private archive.
update public.deposit_confirmations as deposit
set
  reviewed_at = archive.reviewed_at,
  credited_at = archive.credited_at,
  updated_at = archive.updated_at
from private.deposit_confirmation_legacy_timestamps as archive
where archive.deposit_confirmation_id = deposit.id;

-- Give rows created after the forward migration values compatible with the
-- legacy trigger. created_at remains the best available historical timestamp.
update public.deposit_confirmations
set
  reviewed_at = case when status = 'pending' then null else created_at end,
  credited_at = case when status = 'approved' then created_at else null end,
  updated_at = created_at
where updated_at is null;

alter table public.deposit_confirmations
  alter column updated_at set default now(),
  alter column updated_at set not null;

drop policy deposit_confirmations_owner_insert
  on public.deposit_confirmations;

create policy deposit_confirmations_owner_insert
on public.deposit_confirmations
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and credited_at is null
  and review_note is null
  and reviewed_at is null
  and exists (
    select 1
    from public.user_currency_balances as balance
    where balance.user_id = (select auth.uid())
      and balance.currency_code = deposit_confirmations.currency_code
  )
  and (select public.is_current_session_verified())
);

drop trigger deposit_confirmations_review
  on public.deposit_confirmations;

create or replace function private.handle_deposit_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.credited_at is not null and new.status is distinct from old.status then
    raise exception 'A credited deposit cannot change status';
  end if;

  if new.status is distinct from old.status then
    new.reviewed_at = now();
  end if;

  if new.status = 'approved'
    and old.status is distinct from 'approved'
    and old.credited_at is null
  then
    update public.user_currency_balances
    set
      balance = balance + new.amount,
      updated_at = now()
    where user_id = new.user_id
      and currency_code = new.currency_code;

    if not found then
      raise exception 'Currency balance is not enabled for this user';
    end if;

    new.credited_at = now();
  end if;

  return new;
end;
$$;

revoke all on function private.handle_deposit_review()
  from public, anon, authenticated;

create trigger deposit_confirmations_review
before update on public.deposit_confirmations
for each row execute function private.handle_deposit_review();

create trigger deposit_confirmations_set_updated_at
before update on public.deposit_confirmations
for each row execute function private.set_updated_at();

drop table private.deposit_confirmation_legacy_timestamps;

commit;
