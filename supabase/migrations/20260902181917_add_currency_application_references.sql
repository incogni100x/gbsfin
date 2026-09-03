alter table public.currency_access_requests
add column application_reference text;

update public.currency_access_requests
set application_reference =
  'GSF-CUR-' || upper(replace(id::text, '-', ''))
where application_reference is null;

alter table public.currency_access_requests
alter column application_reference set not null;

alter table public.currency_access_requests
add constraint currency_access_requests_application_reference_key
unique (application_reference);

alter table public.currency_access_requests
add constraint currency_access_requests_application_reference_format_check
check (application_reference ~ '^GSF-CUR-[0-9A-F]{32}$');

create or replace function private.set_currency_application_reference()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.application_reference is null then
    new.application_reference :=
      'GSF-CUR-' || upper(replace(new.id::text, '-', ''));
  end if;

  return new;
end;
$$;

create trigger currency_access_requests_set_application_reference
before insert on public.currency_access_requests
for each row execute function private.set_currency_application_reference();

revoke all on function private.set_currency_application_reference() from public;
revoke all on function private.set_currency_application_reference() from anon;
revoke all on function private.set_currency_application_reference() from authenticated;

comment on column public.currency_access_requests.application_reference is
  'Public support reference for a currency access application; never expose the auth user UUID.';
