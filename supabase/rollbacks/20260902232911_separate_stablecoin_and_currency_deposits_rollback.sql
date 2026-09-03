-- Reverses 20260902232911 without discarding stablecoin deposit history.
-- Stablecoin requests without a linked ledger credit are moved back into
-- deposit_confirmations. The safety check stops rollback after a new
-- stablecoin approval so a credited bank account cannot be silently changed.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if exists (
    select 1
    from public.transactions as transaction
    join public.account_deposit_requests as deposit
      on deposit.id = transaction.account_deposit_id
    where deposit.method = 'stablecoin'
  ) then
    raise exception
      'Rollback stopped: a stablecoin deposit has a linked ledger row requiring reconciliation';
  end if;
end;
$$;

drop function if exists public.submit_stablecoin_deposit_request(
  uuid,
  text,
  uuid,
  numeric,
  text
);

drop trigger account_deposit_requests_review
  on public.account_deposit_requests;
drop trigger account_deposit_requests_notify
  on public.account_deposit_requests;
drop policy account_deposit_requests_owner_insert
  on public.account_deposit_requests;
drop function public.submit_account_deposit_request(uuid, text, numeric, uuid, text);

alter table public.currency_deposits
  drop constraint currency_deposits_fiat_only_check;

insert into public.currency_deposits (
  id,
  user_id,
  currency_code,
  instruction_id,
  amount,
  sender_name,
  sender_reference,
  status,
  review_note,
  created_at
)
select
  deposit.id,
  deposit.user_id,
  deposit.currency_code,
  deposit.instruction_id,
  deposit.amount,
  deposit.sender_name,
  coalesce(archive.sender_reference, deposit.application_reference),
  deposit.status,
  deposit.review_note,
  deposit.created_at
from public.account_deposit_requests as deposit
left join private.stablecoin_deposit_migration_archive as archive
  on archive.id = deposit.id
where deposit.method = 'stablecoin'
on conflict (id) do nothing;

insert into private.currency_deposit_legacy_timestamps (
  currency_deposit_id,
  reviewed_at,
  credited_at,
  updated_at
)
select
  deposit.id,
  coalesce(
    archive.legacy_reviewed_at,
    case when deposit.status <> 'pending' then deposit.created_at end
  ),
  coalesce(
    archive.legacy_credited_at,
    case when deposit.status = 'approved' then deposit.created_at end
  ),
  coalesce(archive.legacy_updated_at, deposit.created_at)
from public.account_deposit_requests as deposit
left join private.stablecoin_deposit_migration_archive as archive
  on archive.id = deposit.id
where deposit.method = 'stablecoin'
on conflict (currency_deposit_id) do update
set
  reviewed_at = excluded.reviewed_at,
  credited_at = excluded.credited_at,
  updated_at = excluded.updated_at;

delete from public.account_deposit_requests
where method = 'stablecoin';

alter table public.account_deposit_requests
  drop constraint account_deposit_requests_method_details_check,
  drop constraint account_deposit_requests_instruction_currency_fkey,
  drop constraint account_deposit_requests_currency_code_fkey;

drop index public.account_deposit_requests_instruction_id_idx;
drop index public.account_deposit_requests_currency_code_idx;

drop function private.handle_account_deposit_review();
drop function private.notify_account_deposit_status();

alter type public.account_deposit_method_enum
  rename to account_deposit_method_enum_with_stablecoin;
create type public.account_deposit_method_enum as enum (
  'wire_ach',
  'direct_deposit',
  'cheque'
);
alter table public.account_deposit_requests
  alter column method type public.account_deposit_method_enum
  using method::text::public.account_deposit_method_enum,
  alter column amount type numeric(20, 2) using round(amount, 2),
  drop column currency_code,
  drop column instruction_id,
  drop column sender_name;
drop type public.account_deposit_method_enum_with_stablecoin;

alter table public.account_deposit_requests
  add constraint account_deposit_requests_method_details_check check (
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

revoke all on table public.account_deposit_requests
  from public, anon, authenticated;
grant select on table public.account_deposit_requests to authenticated;
grant insert (
  user_id,
  account_id,
  linked_bank_account_id,
  method,
  amount,
  cheque_file_path
) on table public.account_deposit_requests to authenticated;

create function public.submit_account_deposit_request(
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

create function private.handle_account_deposit_review()
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

create function private.notify_account_deposit_status()
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

create trigger account_deposit_requests_review
before update on public.account_deposit_requests
for each row execute function private.handle_account_deposit_review();

create trigger account_deposit_requests_notify
after insert or update of status on public.account_deposit_requests
for each row execute function private.notify_account_deposit_status();

revoke all on function private.handle_account_deposit_review()
  from public, anon, authenticated;
revoke all on function private.notify_account_deposit_status()
  from public, anon, authenticated;
revoke all on function public.submit_account_deposit_request(uuid, text, numeric, uuid, text)
  from public, anon;
grant execute on function public.submit_account_deposit_request(uuid, text, numeric, uuid, text)
  to authenticated;

-- Restore the original currency-deposit insert policy.
drop policy currency_deposits_owner_insert on public.currency_deposits;
create policy currency_deposits_owner_insert
on public.currency_deposits
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
      and balance.currency_code = currency_deposits.currency_code
  )
  and (select public.is_current_session_verified())
);

-- Restore the previous currency-access behavior.
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
  and currency_code <> 'USD'
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
  and (select public.is_current_session_verified())
)
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and currency_code <> 'USD'
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

  if v_currency_code = 'USD' or not exists (
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

alter function private.handle_currency_deposit_review()
  rename to handle_deposit_review;
alter trigger currency_deposits_review on public.currency_deposits
  rename to deposit_confirmations_review;
alter policy currency_deposits_owner_read on public.currency_deposits
  rename to deposit_confirmations_owner_read;
alter policy currency_deposits_owner_insert on public.currency_deposits
  rename to deposit_confirmations_owner_insert;

alter index public.currency_deposits_user_created_at_idx
  rename to deposit_confirmations_user_created_at_idx;
alter index public.currency_deposits_status_created_at_idx
  rename to deposit_confirmations_status_created_at_idx;
alter index public.currency_deposits_instruction_id_idx
  rename to deposit_confirmations_instruction_id_idx;

alter table public.currency_deposits
  rename constraint currency_deposits_pkey to deposit_confirmations_pkey;
alter table public.currency_deposits
  rename constraint currency_deposits_user_id_fkey
  to deposit_confirmations_user_id_fkey;
alter table public.currency_deposits
  rename constraint currency_deposits_currency_code_fkey
  to deposit_confirmations_currency_code_fkey;
alter table public.currency_deposits
  rename constraint currency_deposits_instruction_currency_fkey
  to deposit_confirmations_instruction_currency_fkey;
alter table public.currency_deposits
  rename constraint currency_deposits_amount_positive
  to deposit_confirmations_amount_positive;

alter table public.currency_deposits rename to deposit_confirmations;
alter table private.currency_deposit_legacy_timestamps
  rename column currency_deposit_id to deposit_confirmation_id;
alter table private.currency_deposit_legacy_timestamps
  rename to deposit_confirmation_legacy_timestamps;

drop table private.stablecoin_deposit_migration_archive;

comment on table public.deposit_confirmations is
  'Pending and reviewed deposits into enabled currency balances.';
comment on table public.account_deposit_requests is
  'Pending and reviewed deposits into user bank accounts via Wire/ACH, direct deposit, or cheque.';

commit;
