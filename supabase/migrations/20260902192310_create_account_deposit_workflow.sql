begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

create type public.account_deposit_method_enum as enum (
  'wire_ach',
  'direct_deposit',
  'cheque'
);

create table public.account_deposit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_id uuid not null references public.user_accounts (id) on delete cascade,
  linked_bank_account_id uuid references public.linked_bank_accounts (id)
    on delete set null,
  method public.account_deposit_method_enum not null,
  amount numeric(20, 2) not null,
  cheque_file_path text,
  application_reference text not null,
  status public.request_status not null default 'pending',
  review_note text,
  created_at timestamptz not null default now(),
  constraint account_deposit_requests_amount_positive check (amount > 0),
  constraint account_deposit_requests_application_reference_key
    unique (application_reference),
  constraint account_deposit_requests_application_reference_format_check
    check (application_reference ~ '^GSF-DEP-[0-9A-F]{32}$'),
  constraint account_deposit_requests_method_details_check check (
    (
      method = 'wire_ach'
      and cheque_file_path is null
    )
    or (
      method = 'direct_deposit'
      and linked_bank_account_id is null
      and cheque_file_path is null
    )
    or (
      method = 'cheque'
      and linked_bank_account_id is null
      and cheque_file_path is not null
      and cheque_file_path like user_id::text || '/%'
    )
  )
);

create index account_deposit_requests_user_created_at_idx
  on public.account_deposit_requests (user_id, created_at desc);
create index account_deposit_requests_account_id_idx
  on public.account_deposit_requests (account_id);
create index account_deposit_requests_linked_bank_account_id_idx
  on public.account_deposit_requests (linked_bank_account_id)
  where linked_bank_account_id is not null;
create index account_deposit_requests_status_created_at_idx
  on public.account_deposit_requests (status, created_at);

create or replace function private.set_account_deposit_reference()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.application_reference is null or btrim(new.application_reference) = '' then
    new.application_reference :=
      'GSF-DEP-' || upper(replace(new.id::text, '-', ''));
  end if;

  return new;
end;
$$;

create trigger account_deposit_requests_set_reference
before insert on public.account_deposit_requests
for each row execute function private.set_account_deposit_reference();

alter table public.account_deposit_requests enable row level security;

revoke all on table public.account_deposit_requests from public, anon, authenticated;
grant select on table public.account_deposit_requests to authenticated;
grant insert (
  user_id,
  account_id,
  linked_bank_account_id,
  method,
  amount,
  cheque_file_path
) on table public.account_deposit_requests to authenticated;
grant select, update on table public.account_deposit_requests to service_role;

create policy account_deposit_requests_owner_select
on public.account_deposit_requests
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

create policy account_deposit_requests_owner_insert
on public.account_deposit_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and review_note is null
  and exists (
    select 1
    from public.user_accounts as account
    where account.id = account_deposit_requests.account_id
      and account.user_id = (select auth.uid())
  )
  and (
    (
      method = 'wire_ach'
      and exists (
        select 1
        from public.linked_bank_accounts as linked_account
        where linked_account.id = account_deposit_requests.linked_bank_account_id
          and linked_account.user_id = (select auth.uid())
      )
    )
    or method = 'direct_deposit'
    or (
      method = 'cheque'
      and cheque_file_path like (select auth.uid())::text || '/%'
    )
  )
  and (select public.is_current_session_verified())
);

create or replace function public.submit_account_deposit_request(
  p_account_id uuid,
  p_method text,
  p_amount numeric,
  p_linked_bank_account_id uuid default null,
  p_cheque_file_path text default null
)
returns public.account_deposit_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_method text := lower(btrim(p_method));
  v_request public.account_deposit_requests;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Deposit amount must be greater than zero';
  end if;

  if v_method not in ('wire_ach', 'direct_deposit', 'cheque') then
    raise exception 'Unsupported deposit method';
  end if;

  if not exists (
    select 1
    from public.user_accounts as account
    where account.id = p_account_id
      and account.user_id = v_user_id
  ) then
    raise exception 'Destination account was not found';
  end if;

  if v_method = 'wire_ach' and not exists (
    select 1
    from public.linked_bank_accounts as linked_account
    where linked_account.id = p_linked_bank_account_id
      and linked_account.user_id = v_user_id
  ) then
    raise exception 'Linked bank account was not found';
  end if;

  if v_method = 'cheque' and (
    p_cheque_file_path is null
    or p_cheque_file_path not like v_user_id::text || '/%'
  ) then
    raise exception 'A cheque image is required';
  end if;

  insert into public.account_deposit_requests (
    user_id,
    account_id,
    linked_bank_account_id,
    method,
    amount,
    cheque_file_path
  )
  values (
    v_user_id,
    p_account_id,
    case when v_method = 'wire_ach' then p_linked_bank_account_id else null end,
    v_method::public.account_deposit_method_enum,
    round(p_amount, 2),
    case when v_method = 'cheque' then p_cheque_file_path else null end
  )
  returning * into v_request;

  return v_request;
end;
$$;

alter table public.transactions
add column account_deposit_id uuid references public.account_deposit_requests (id)
  on delete set null;

create index transactions_account_deposit_id_idx
  on public.transactions (account_deposit_id)
  where account_deposit_id is not null;

alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (
  type in (
    'account_deposit',
    'fixed_deposit_funding',
    'fixed_deposit_payout',
    'loan_disbursement',
    'loan_repayment'
  )
);

create or replace function private.handle_account_deposit_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.application_reference is distinct from old.application_reference then
    raise exception 'The application reference cannot be changed';
  end if;

  if old.status in ('approved', 'rejected') and (
    new.status is distinct from old.status
    or new.user_id is distinct from old.user_id
    or new.account_id is distinct from old.account_id
    or new.linked_bank_account_id is distinct from old.linked_bank_account_id
    or new.method is distinct from old.method
    or new.amount is distinct from old.amount
    or new.cheque_file_path is distinct from old.cheque_file_path
  ) then
    raise exception 'A reviewed deposit cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
      raise exception 'Invalid account deposit status transition';
    end if;

    if new.status = 'approved' then
      update public.user_accounts
      set balance = balance + new.amount
      where id = new.account_id
        and user_id = new.user_id;

      if not found then
        raise exception 'Destination account was not found';
      end if;

      insert into public.transactions (
        user_id,
        account_id,
        type,
        direction,
        amount,
        currency_code,
        status,
        note,
        account_deposit_id,
        created_at
      )
      values (
        new.user_id,
        new.account_id,
        'account_deposit',
        'credit',
        new.amount,
        'USD',
        'completed',
        case new.method
          when 'wire_ach' then 'Wire / ACH deposit'
          when 'direct_deposit' then 'Direct deposit'
          else 'Cheque deposit'
        end,
        new.id,
        new.created_at
      );
    end if;
  end if;

  return new;
end;
$$;

create trigger account_deposit_requests_review
before update on public.account_deposit_requests
for each row execute function private.handle_account_deposit_review();

create or replace function private.notify_account_deposit_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, message)
    values (
      new.user_id,
      'deposit',
      'Deposit request submitted',
      format('%s is pending review.', new.application_reference)
    );
  elsif new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, message)
    values (
      new.user_id,
      'deposit',
      case new.status
        when 'approved' then 'Deposit approved'
        else 'Deposit rejected'
      end,
      format('%s was %s.', new.application_reference, new.status::text)
    );
  end if;

  return new;
end;
$$;

create trigger account_deposit_requests_notify
after insert or update of status on public.account_deposit_requests
for each row execute function private.notify_account_deposit_status();

revoke all on function private.set_account_deposit_reference()
  from public, anon, authenticated;
revoke all on function private.handle_account_deposit_review()
  from public, anon, authenticated;
revoke all on function private.notify_account_deposit_status()
  from public, anon, authenticated;
revoke all on function public.submit_account_deposit_request(uuid, text, numeric, uuid, text)
  from public, anon;
grant execute on function public.submit_account_deposit_request(uuid, text, numeric, uuid, text)
  to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'cheque-deposits',
  'cheque-deposits',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy cheque_deposits_owner_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'cheque-deposits'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.is_current_session_verified())
);

create policy cheque_deposits_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'cheque-deposits'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.is_current_session_verified())
);

create policy cheque_deposits_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'cheque-deposits'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and (select public.is_current_session_verified())
);

comment on table public.account_deposit_requests is
  'Pending and reviewed deposits into user bank accounts via Wire/ACH, direct deposit, or cheque.';

commit;
