-- Manual rollback only. Obtain explicit approval before running because it drops
-- application_reference from public.currency_access_requests.
-- The archive preserves every generated reference for recovery or audit.

begin;

create table if not exists private.currency_application_reference_archive (
  request_id uuid primary key,
  application_reference text not null,
  archived_at timestamptz not null default now()
);

insert into private.currency_application_reference_archive (
  request_id,
  application_reference
)
select id, application_reference
from public.currency_access_requests
on conflict (request_id) do update
set
  application_reference = excluded.application_reference,
  archived_at = now();

revoke all on table private.currency_application_reference_archive from public;
revoke all on table private.currency_application_reference_archive from anon;
revoke all on table private.currency_application_reference_archive from authenticated;

drop trigger if exists currency_access_requests_set_application_reference
on public.currency_access_requests;

drop function if exists private.set_currency_application_reference();

alter table public.currency_access_requests
drop constraint if exists currency_access_requests_application_reference_format_check;

alter table public.currency_access_requests
drop constraint if exists currency_access_requests_application_reference_key;

alter table public.currency_access_requests
drop column if exists application_reference;

commit;
