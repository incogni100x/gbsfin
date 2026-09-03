begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Preserve every stablecoin row, including the timestamps archived by the
-- earlier timestamp-simplification migration. This table is intentionally
-- retained so the companion rollback can reconstruct the previous model.
create table private.stablecoin_deposit_migration_archive (
  id uuid primary key,
  user_id uuid not null,
  currency_code text not null,
  instruction_id uuid not null,
  amount numeric(24, 6) not null,
  sender_name text not null,
  sender_reference text,
  status public.request_status not null,
  review_note text,
  created_at timestamptz not null,
  legacy_reviewed_at timestamptz,
  legacy_credited_at timestamptz,
  legacy_updated_at timestamptz,
  archived_at timestamptz not null default now(),
  constraint stablecoin_deposit_migration_archive_currency_check
    check (currency_code in ('USDC', 'USDT'))
);

revoke all on table private.stablecoin_deposit_migration_archive
  from public, anon, authenticated;

insert into private.stablecoin_deposit_migration_archive (
  id,
  user_id,
  currency_code,
  instruction_id,
  amount,
  sender_name,
  sender_reference,
  status,
  review_note,
  created_at,
  legacy_reviewed_at,
  legacy_credited_at,
  legacy_updated_at
)
select
  deposit.id,
  deposit.user_id,
  deposit.currency_code,
  deposit.instruction_id,
  deposit.amount,
  deposit.sender_name,
  deposit.sender_reference,
  deposit.status,
  deposit.review_note,
  deposit.created_at,
  legacy.reviewed_at,
  legacy.credited_at,
  legacy.updated_at
from public.deposit_confirmations as deposit
left join private.deposit_confirmation_legacy_timestamps as legacy
  on legacy.deposit_confirmation_id = deposit.id
where deposit.currency_code in ('USDC', 'USDT');

-- Rename the fiat-currency table and its public-facing database objects.
alter table public.deposit_confirmations rename to currency_deposits;
alter table public.currency_deposits
  rename constraint deposit_confirmations_pkey to currency_deposits_pkey;
alter table public.currency_deposits
  rename constraint deposit_confirmations_user_id_fkey
  to currency_deposits_user_id_fkey;
alter table public.currency_deposits
  rename constraint deposit_confirmations_currency_code_fkey
  to currency_deposits_currency_code_fkey;
alter table public.currency_deposits
  rename constraint deposit_confirmations_instruction_currency_fkey
  to currency_deposits_instruction_currency_fkey;
alter table public.currency_deposits
  rename constraint deposit_confirmations_amount_positive
  to currency_deposits_amount_positive;

alter index public.deposit_confirmations_user_created_at_idx
  rename to currency_deposits_user_created_at_idx;
alter index public.deposit_confirmations_status_created_at_idx
  rename to currency_deposits_status_created_at_idx;
alter index public.deposit_confirmations_instruction_id_idx
  rename to currency_deposits_instruction_id_idx;

alter trigger deposit_confirmations_review on public.currency_deposits
  rename to currency_deposits_review;
alter policy deposit_confirmations_owner_read on public.currency_deposits
  rename to currency_deposits_owner_read;
alter policy deposit_confirmations_owner_insert on public.currency_deposits
  rename to currency_deposits_owner_insert;
alter function private.handle_deposit_review()
  rename to handle_currency_deposit_review;

alter table private.deposit_confirmation_legacy_timestamps
  rename to currency_deposit_legacy_timestamps;
alter table private.currency_deposit_legacy_timestamps
  rename column deposit_confirmation_id to currency_deposit_id;

-- Currency deposits are now fiat-only. Add the constraint after stablecoin
-- rows have been copied to the account-deposit workflow below.
drop policy account_deposit_requests_owner_insert
  on public.account_deposit_requests;
drop trigger account_deposit_requests_review
  on public.account_deposit_requests;
drop trigger account_deposit_requests_notify
  on public.account_deposit_requests;
alter table public.account_deposit_requests
  drop constraint account_deposit_requests_method_details_check;

alter type public.account_deposit_method_enum
  rename to account_deposit_method_enum_legacy;
create type public.account_deposit_method_enum as enum (
  'wire_ach',
  'direct_deposit',
  'cheque',
  'stablecoin'
);
alter table public.account_deposit_requests
  alter column method type public.account_deposit_method_enum
  using method::text::public.account_deposit_method_enum;
drop type public.account_deposit_method_enum_legacy;

alter table public.account_deposit_requests
  alter column amount type numeric(24, 6),
  add column currency_code text,
  add column instruction_id uuid,
  add column sender_name text;

update public.account_deposit_requests as deposit
set currency_code = account.currency_code
from public.user_accounts as account
where account.id = deposit.account_id;

alter table public.account_deposit_requests
  alter column currency_code set not null,
  add constraint account_deposit_requests_currency_code_fkey
    foreign key (currency_code) references public.currencies (code),
  add constraint account_deposit_requests_instruction_currency_fkey
    foreign key (instruction_id, currency_code)
    references public.deposit_instructions (id, currency_code),
  add constraint account_deposit_requests_method_details_check check (
    (
      method = 'wire_ach'
      and account_id is not null
      and linked_bank_account_id is not null
      and cheque_file_path is null
      and instruction_id is null
      and sender_name is null
    )
    or (
      method = 'direct_deposit'
      and account_id is not null
      and linked_bank_account_id is null
      and cheque_file_path is null
      and instruction_id is null
      and sender_name is null
    )
    or (
      method = 'cheque'
      and account_id is not null
      and linked_bank_account_id is null
      and cheque_file_path is not null
      and cheque_file_path like user_id::text || '/%'
      and instruction_id is null
      and sender_name is null
    )
    or (
      method = 'stablecoin'
      and account_id is not null
      and linked_bank_account_id is null
      and cheque_file_path is null
      and currency_code in ('USDC', 'USDT')
      and instruction_id is not null
      and nullif(btrim(sender_name), '') is not null
  )
);

-- Stablecoin deposits settle into an existing USD-denominated bank account.
-- Stop before moving any history if a legacy row cannot be assigned safely.
do $$
begin
  if exists (
    select 1
    from private.stablecoin_deposit_migration_archive as archive
    where not exists (
      select 1
      from public.user_accounts as account
      where account.user_id = archive.user_id
        and account.currency_code = 'USD'
    )
  ) then
    raise exception
      'Stablecoin migration stopped: a user with stablecoin history has no USD account';
  end if;
end;
$$;

create index account_deposit_requests_currency_code_idx
  on public.account_deposit_requests (currency_code);
create index account_deposit_requests_instruction_id_idx
  on public.account_deposit_requests (instruction_id)
  where instruction_id is not null;

insert into public.account_deposit_requests (
  id,
  user_id,
  account_id,
  linked_bank_account_id,
  method,
  amount,
  cheque_file_path,
  application_reference,
  status,
  review_note,
  created_at,
  currency_code,
  instruction_id,
  sender_name
)
select
  archive.id,
  archive.user_id,
  (
    select account.id
    from public.user_accounts as account
    where account.user_id = archive.user_id
      and account.currency_code = 'USD'
    order by account.created_at, account.id
    limit 1
  ),
  null,
  'stablecoin'::public.account_deposit_method_enum,
  archive.amount,
  null,
  'GSF-DEP-' || upper(replace(archive.id::text, '-', '')),
  archive.status,
  archive.review_note,
  archive.created_at,
  archive.currency_code,
  archive.instruction_id,
  archive.sender_name
from private.stablecoin_deposit_migration_archive as archive;

delete from public.currency_deposits
where currency_code in ('USDC', 'USDT');

alter table public.currency_deposits
  add constraint currency_deposits_fiat_only_check
  check (currency_code not in ('USDC', 'USDT'));

drop policy currency_deposits_owner_insert on public.currency_deposits;
create policy currency_deposits_owner_insert
on public.currency_deposits
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and review_note is null
  and currency_code not in ('USDC', 'USDT')
  and exists (
    select 1
    from public.user_currency_balances as balance
    where balance.user_id = (select auth.uid())
      and balance.currency_code = currency_deposits.currency_code
  )
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
  and (
    (
      method in ('wire_ach', 'direct_deposit', 'cheque')
      and exists (
        select 1
        from public.user_accounts as account
        where account.id = account_deposit_requests.account_id
          and account.user_id = (select auth.uid())
          and account.currency_code = account_deposit_requests.currency_code
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
    )
    or (
      method = 'stablecoin'
      and currency_code in ('USDC', 'USDT')
      and exists (
        select 1
        from public.user_accounts as account
        where account.id = account_deposit_requests.account_id
          and account.user_id = (select auth.uid())
          and account.currency_code = 'USD'
      )
      and exists (
        select 1
        from public.deposit_instructions as instruction
        where instruction.id = account_deposit_requests.instruction_id
          and instruction.currency_code = account_deposit_requests.currency_code
          and instruction.is_active
          and instruction.wallet_address is not null
      )
    )
  )
  and (select public.is_current_session_verified())
);

revoke all on table public.account_deposit_requests
  from public, anon, authenticated;
grant select on table public.account_deposit_requests to authenticated;
grant insert (
  user_id,
  account_id,
  linked_bank_account_id,
  method,
  amount,
  cheque_file_path,
  currency_code,
  instruction_id,
  sender_name
) on table public.account_deposit_requests to authenticated;

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
  v_currency_code text;
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

  select account.currency_code
  into v_currency_code
  from public.user_accounts as account
  where account.id = p_account_id
    and account.user_id = v_user_id;

  if not found then
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
    cheque_file_path,
    currency_code
  )
  values (
    v_user_id,
    p_account_id,
    case when v_method = 'wire_ach' then p_linked_bank_account_id else null end,
    v_method::public.account_deposit_method_enum,
    round(p_amount, 2),
    case when v_method = 'cheque' then p_cheque_file_path else null end,
    v_currency_code
  )
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function public.submit_stablecoin_deposit_request(
  p_account_id uuid,
  p_currency_code text,
  p_instruction_id uuid,
  p_amount numeric,
  p_sender_name text
)
returns public.account_deposit_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency_code text := upper(btrim(p_currency_code));
  v_sender_name text := btrim(p_sender_name);
  v_request public.account_deposit_requests;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if v_currency_code not in ('USDC', 'USDT') then
    raise exception 'Only USDC and USDT are supported stablecoin deposits';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Deposit amount must be greater than zero';
  end if;

  if nullif(v_sender_name, '') is null then
    raise exception 'Sender name is required';
  end if;

  if not exists (
    select 1
    from public.user_accounts as account
    where account.id = p_account_id
      and account.user_id = v_user_id
      and account.currency_code = 'USD'
  ) then
    raise exception 'A USD destination account is required';
  end if;

  if not exists (
    select 1
    from public.deposit_instructions as instruction
    where instruction.id = p_instruction_id
      and instruction.currency_code = v_currency_code
      and instruction.is_active
      and instruction.wallet_address is not null
  ) then
    raise exception 'Stablecoin deposit details were not found';
  end if;

  insert into public.account_deposit_requests (
    user_id,
    account_id,
    method,
    amount,
    currency_code,
    instruction_id,
    sender_name
  )
  values (
    v_user_id,
    p_account_id,
    'stablecoin',
    round(p_amount, 6),
    v_currency_code,
    p_instruction_id,
    v_sender_name
  )
  returning * into v_request;

  return v_request;
end;
$$;

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
    or new.currency_code is distinct from old.currency_code
    or new.instruction_id is distinct from old.instruction_id
    or new.sender_name is distinct from old.sender_name
  ) then
    raise exception 'A reviewed deposit cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if old.status <> 'pending' or new.status not in ('approved', 'rejected') then
      raise exception 'Invalid account deposit status transition';
    end if;

    if new.status = 'approved' then
      update public.user_accounts
      set balance = balance + round(new.amount, 2)
      where id = new.account_id
        and user_id = new.user_id
        and (
          new.method <> 'stablecoin'
          or currency_code = 'USD'
        );

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
          round(new.amount, 2),
          case when new.method = 'stablecoin' then 'USD' else new.currency_code end,
          'completed',
          case new.method
            when 'wire_ach' then 'Wire / ACH deposit'
            when 'direct_deposit' then 'Direct deposit'
            when 'cheque' then 'Cheque deposit'
            else new.currency_code || ' stablecoin deposit'
          end,
          new.id,
          new.created_at
        );
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.notify_account_deposit_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject text := case
    when new.method = 'stablecoin' then new.currency_code || ' deposit'
    else 'Deposit'
  end;
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, type, title, message)
    values (
      new.user_id,
      'deposit',
      v_subject || ' request submitted',
      format('%s is pending review.', new.application_reference)
    );
  elsif new.status is distinct from old.status then
    insert into public.notifications (user_id, type, title, message)
    values (
      new.user_id,
      'deposit',
      v_subject || case new.status
        when 'approved' then ' approved'
        else ' rejected'
      end,
      format('%s was %s.', new.application_reference, new.status::text)
    );
  end if;

  return new;
end;
$$;

create trigger account_deposit_requests_review
before update on public.account_deposit_requests
for each row execute function private.handle_account_deposit_review();

create trigger account_deposit_requests_notify
after insert or update of status on public.account_deposit_requests
for each row execute function private.notify_account_deposit_status();

revoke all on function public.submit_stablecoin_deposit_request(uuid, text, uuid, numeric, text)
  from public, anon;
grant execute on function public.submit_stablecoin_deposit_request(uuid, text, uuid, numeric, text)
  to authenticated;

-- USDC and USDT stay in the shared currency catalog because deposit
-- instructions and transfer history reference their codes. They are removed
-- only from the optional fiat-currency application workflow.

drop policy currency_access_requests_owner_insert
  on public.currency_access_requests;
drop policy currency_access_requests_owner_reapply
  on public.currency_access_requests;

create policy currency_access_requests_owner_insert
on public.currency_access_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and review_note is null
  and reviewed_at is null
  and currency_code not in ('USD', 'USDC', 'USDT')
  and exists (
    select 1
    from public.currencies as currency
    where currency.code = currency_access_requests.currency_code
      and currency.is_active
  )
  and (select public.is_current_session_verified())
);

create policy currency_access_requests_owner_reapply
on public.currency_access_requests
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and status = 'rejected'
  and currency_code not in ('USD', 'USDC', 'USDT')
  and (select public.is_current_session_verified())
)
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and currency_code not in ('USD', 'USDC', 'USDT')
  and (select public.is_current_session_verified())
);

create or replace function public.request_currency_access(p_currency_code text)
returns public.currency_access_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency_code text := upper(btrim(p_currency_code));
  v_request public.currency_access_requests;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if v_currency_code in ('USD', 'USDC', 'USDT') or not exists (
    select 1
    from public.currencies as currency
    where currency.code = v_currency_code
      and currency.is_active
  ) then
    raise exception 'This currency cannot be requested';
  end if;

  select request.*
  into v_request
  from public.currency_access_requests as request
  where request.user_id = v_user_id
    and request.currency_code = v_currency_code;

  if found then
    if v_request.status = 'rejected' then
      update public.currency_access_requests
      set status = 'pending'
      where id = v_request.id
      returning * into v_request;
    end if;

    return v_request;
  end if;

  insert into public.currency_access_requests (user_id, currency_code)
  values (v_user_id, v_currency_code)
  returning * into v_request;

  return v_request;
end;
$$;

do $$
declare
  v_archived_count bigint;
  v_migrated_count bigint;
begin
  select count(*) into v_archived_count
  from private.stablecoin_deposit_migration_archive;

  select count(*) into v_migrated_count
  from public.account_deposit_requests
  where method = 'stablecoin';

  if v_archived_count <> v_migrated_count then
    raise exception
      'Stablecoin migration count mismatch: archived %, migrated %',
      v_archived_count,
      v_migrated_count;
  end if;

  if exists (
    select 1 from public.currency_deposits
    where currency_code in ('USDC', 'USDT')
  ) then
    raise exception 'Stablecoin rows remain in currency_deposits';
  end if;

  if exists (
    select 1
    from public.account_deposit_requests as deposit
    join public.user_accounts as account on account.id = deposit.account_id
    where deposit.method = 'stablecoin'
      and (
        account.user_id <> deposit.user_id
        or account.currency_code <> 'USD'
      )
  ) then
    raise exception 'A stablecoin deposit is not assigned to its user''s USD account';
  end if;
end;
$$;

comment on table public.currency_deposits is
  'Pending and reviewed deposits into enabled fiat currency balances.';
comment on table public.account_deposit_requests is
  'Pending and reviewed deposits into user bank accounts, including stablecoin deposits credited to USD accounts.';

commit;
