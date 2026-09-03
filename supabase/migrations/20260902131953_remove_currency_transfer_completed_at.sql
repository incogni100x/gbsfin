begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Retain the removed values privately until the migration is proven stable.
create table private.currency_transfer_legacy_timestamps (
  currency_transfer_id uuid primary key
    references public.currency_transfers (id) on delete cascade,
  completed_at timestamptz not null,
  archived_at timestamptz not null default now()
);

revoke all on table private.currency_transfer_legacy_timestamps
  from public, anon, authenticated;

insert into private.currency_transfer_legacy_timestamps (
  currency_transfer_id,
  completed_at
)
select
  id,
  completed_at
from public.currency_transfers;

alter table public.currency_transfers
  drop column completed_at;

commit;
