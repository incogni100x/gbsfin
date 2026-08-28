do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'notification_type_enum'
  ) then
    create type public.notification_type_enum as enum (
      'account', 'security', 'transaction', 'deposit', 'loan', 'system'
    );
  end if;
end
$$;

create table public.linked_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_name text not null,
  account_holder_name text not null,
  bank_name text not null,
  account_number text not null,
  routing_number text,
  iban text,
  swift_code text,
  country_code text not null default 'US',
  currency_code text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint linked_bank_accounts_account_name_check
    check (length(btrim(account_name)) between 2 and 80),
  constraint linked_bank_accounts_account_holder_name_check
    check (length(btrim(account_holder_name)) between 2 and 120),
  constraint linked_bank_accounts_bank_name_check
    check (length(btrim(bank_name)) between 2 and 120),
  constraint linked_bank_accounts_account_number_check
    check (length(btrim(account_number)) between 4 and 64),
  constraint linked_bank_accounts_country_code_check
    check (country_code ~ '^[A-Z]{2}$'),
  constraint linked_bank_accounts_currency_code_check
    check (currency_code ~ '^[A-Z]{3,4}$'),
  constraint linked_bank_accounts_user_account_number_key
    unique (user_id, account_number)
);

create index linked_bank_accounts_user_id_idx
  on public.linked_bank_accounts (user_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type_enum not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint notifications_title_check check (length(btrim(title)) between 1 and 160),
  constraint notifications_message_check check (length(btrim(message)) between 1 and 1000)
);

create index notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

create index notifications_type_idx
  on public.notifications (type);

create trigger linked_bank_accounts_set_updated_at
before update on public.linked_bank_accounts
for each row execute function private.set_updated_at();

create or replace function private.notify_linked_bank_account_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_name text;
  v_user_id uuid;
begin
  v_account_name := coalesce(new.account_name, old.account_name);
  v_user_id := coalesce(new.user_id, old.user_id);

  insert into public.notifications (user_id, type, title, message)
  values (
    v_user_id,
    'account',
    case tg_op
      when 'INSERT' then 'Bank account linked'
      when 'UPDATE' then 'Linked bank account updated'
      else 'Linked bank account removed'
    end,
    case tg_op
      when 'INSERT' then format('%s is now linked to your profile.', v_account_name)
      when 'UPDATE' then format('%s details were updated.', v_account_name)
      else format('%s was removed from your profile.', v_account_name)
    end
  );

  return coalesce(new, old);
end;
$$;

create trigger linked_bank_accounts_notify_change
after insert or update or delete on public.linked_bank_accounts
for each row execute function private.notify_linked_bank_account_change();

alter table public.linked_bank_accounts enable row level security;
alter table public.notifications enable row level security;

revoke all on table public.linked_bank_accounts from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;

grant select, insert, update, delete on table public.linked_bank_accounts to authenticated;
grant select on table public.notifications to authenticated;
grant update (is_read) on table public.notifications to authenticated;

create policy linked_bank_accounts_owner_select
on public.linked_bank_accounts
for select to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

create policy linked_bank_accounts_owner_insert
on public.linked_bank_accounts
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

create policy linked_bank_accounts_owner_update
on public.linked_bank_accounts
for update to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
)
with check (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

create policy linked_bank_accounts_owner_delete
on public.linked_bank_accounts
for delete to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

create policy notifications_owner_select
on public.notifications
for select to authenticated
using (
  (select auth.uid()) = user_id
  and (expires_at is null or expires_at > now())
);

create policy notifications_owner_update
on public.notifications
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on function private.notify_linked_bank_account_change() from public, anon, authenticated;
