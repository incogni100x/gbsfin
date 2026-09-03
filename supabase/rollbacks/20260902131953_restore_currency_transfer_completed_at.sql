-- Manual rollback for migration 20260902131953.
-- Run only after explicit approval.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.currency_transfers
  add column completed_at timestamptz;

update public.currency_transfers as transfer
set completed_at = archive.completed_at
from private.currency_transfer_legacy_timestamps as archive
where archive.currency_transfer_id = transfer.id;

-- Transfers created after the forward migration completed atomically when
-- created, so created_at is their correct fallback completion timestamp.
update public.currency_transfers
set completed_at = created_at
where completed_at is null;

alter table public.currency_transfers
  alter column completed_at set default now(),
  alter column completed_at set not null;

drop table private.currency_transfer_legacy_timestamps;

commit;
