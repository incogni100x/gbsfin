begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Keep a private, restorable copy of every timestamp removed by this migration.
-- This table is intentionally retained until the migration has been proven stable.
create table private.deposit_confirmation_legacy_timestamps (
  deposit_confirmation_id uuid primary key
    references public.deposit_confirmations (id) on delete cascade,
  reviewed_at timestamptz,
  credited_at timestamptz,
  updated_at timestamptz not null,
  archived_at timestamptz not null default now()
);

revoke all on table private.deposit_confirmation_legacy_timestamps
  from public, anon, authenticated;

insert into private.deposit_confirmation_legacy_timestamps (
  deposit_confirmation_id,
  reviewed_at,
  credited_at,
  updated_at
)
select
  id,
  reviewed_at,
  credited_at,
  updated_at
from public.deposit_confirmations;

-- Remove dependencies on the legacy columns before dropping them.
drop policy deposit_confirmations_owner_insert
  on public.deposit_confirmations;

create policy deposit_confirmations_owner_insert
on public.deposit_confirmations
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and review_note is null
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

drop trigger deposit_confirmations_set_updated_at
  on public.deposit_confirmations;

create or replace function private.handle_deposit_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Approval credits the balance exactly once. Once credited, the financial
  -- identity and status are immutable, while created_at remains backdatable.
  if old.status = 'approved' and (
    new.status is distinct from old.status
    or new.user_id is distinct from old.user_id
    or new.currency_code is distinct from old.currency_code
    or new.instruction_id is distinct from old.instruction_id
    or new.amount is distinct from old.amount
    or new.sender_name is distinct from old.sender_name
    or new.sender_reference is distinct from old.sender_reference
  ) then
    raise exception 'An approved deposit cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
      raise exception 'Invalid deposit status transition from % to %', old.status, new.status;
    end if;

    if new.status = 'approved' then
      update public.user_currency_balances
      set
        balance = balance + new.amount,
        updated_at = now()
      where user_id = new.user_id
        and currency_code = new.currency_code;

      if not found then
        raise exception 'Currency balance is not enabled for this user';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_deposit_review()
  from public, anon, authenticated;

create trigger deposit_confirmations_review
before update on public.deposit_confirmations
for each row execute function private.handle_deposit_review();

alter table public.deposit_confirmations
  drop column reviewed_at,
  drop column credited_at,
  drop column updated_at;

commit;
