-- Reverses 20260930103146_enable_stablecoin_currency_access.sql.
-- This rollback deliberately stops if the new stablecoin currency-deposit
-- flow has accepted data. That history must be reconciled explicitly rather
-- than silently reclassified as a USD bank-account deposit.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if exists (
    select 1
    from public.currency_deposits
    where currency_code in ('USDC', 'USDT')
  ) then
    raise exception
      'Rollback stopped: stablecoin currency deposits exist and require reconciliation';
  end if;
end;
$$;

-- Retain any applications created after the migration before restoring the
-- previous state.
create table if not exists private.stablecoin_access_request_rollback_archive_20260930
  (like public.currency_access_requests including all);
revoke all on table private.stablecoin_access_request_rollback_archive_20260930
  from public, anon, authenticated;

insert into private.stablecoin_access_request_rollback_archive_20260930
select *
from public.currency_access_requests
where currency_code in ('USDC', 'USDT')
on conflict (id) do nothing;

drop function public.request_currency_transfer(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
);
alter function public.request_currency_transfer_before_stablecoin_access(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) rename to request_currency_transfer;
grant execute on function public.request_currency_transfer(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) to authenticated, service_role;

drop function public.convert_checking_account_balance(uuid, numeric, text);
alter function public.convert_checking_account_balance_before_stablecoin_access(
  uuid, numeric, text
) rename to convert_checking_account_balance;
grant execute on function public.convert_checking_account_balance(
  uuid, numeric, text
) to authenticated, service_role;

drop function public.convert_currency_balance(text, numeric, text, text, uuid);
alter function public.convert_currency_balance_before_stablecoin_access(
  text, numeric, text, text, uuid
) rename to convert_currency_balance;
grant execute on function public.convert_currency_balance(
  text, numeric, text, text, uuid
) to authenticated, service_role;

drop trigger currency_deposits_review on public.currency_deposits;
drop function private.handle_currency_deposit_review();
alter function private.handle_currency_deposit_review_before_stablecoin_access()
  rename to handle_currency_deposit_review;
create trigger currency_deposits_review
before update on public.currency_deposits
for each row execute function private.handle_currency_deposit_review();

drop trigger currency_access_requests_review
  on public.currency_access_requests;
drop function private.handle_currency_request_review();
alter function private.handle_currency_request_review_before_stablecoin_access()
  rename to handle_currency_request_review;
create trigger currency_access_requests_review
before update on public.currency_access_requests
for each row execute function private.handle_currency_request_review();

drop function public.request_currency_access(text);
alter function public.request_currency_access_before_stablecoin_access(text)
  rename to request_currency_access;
grant execute on function public.request_currency_access(text)
  to authenticated;

delete from public.currency_access_requests
where currency_code in ('USDC', 'USDT');

insert into public.currency_access_requests (
  id,
  user_id,
  currency_code,
  status,
  review_note,
  reviewed_at,
  created_at,
  updated_at,
  application_reference
)
select
  id,
  user_id,
  currency_code,
  status,
  review_note,
  reviewed_at,
  created_at,
  updated_at,
  application_reference
from private.stablecoin_access_request_archive_20260930;

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

drop policy account_deposit_requests_owner_insert
  on public.account_deposit_requests;
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

grant execute on function public.submit_stablecoin_deposit_request(
  uuid, text, uuid, numeric, text
) to authenticated;

drop policy currency_deposits_owner_insert
  on public.currency_deposits;
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

alter table public.currency_deposits
  add constraint currency_deposits_fiat_only_check
  check (currency_code not in ('USDC', 'USDT'));

drop policy deposit_instructions_approved_currency_read
  on public.deposit_instructions;
create policy deposit_instructions_approved_currency_read
on public.deposit_instructions
for select
to authenticated
using (
  is_active
  and (select public.is_current_session_verified())
  and (
    currency_code in ('USDC', 'USDT')
    or exists (
      select 1
      from public.user_currency_balances as balance
      where balance.user_id = (select auth.uid())
        and balance.currency_code = deposit_instructions.currency_code
    )
  )
);

drop policy user_currency_balances_owner_read
  on public.user_currency_balances;
create policy user_currency_balances_owner_read
on public.user_currency_balances
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

alter table public.user_currency_balances
  drop column is_enabled;

comment on table public.currency_deposits is
  'Pending and reviewed deposits into enabled fiat currency balances.';

commit;
