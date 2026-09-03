-- Manual rollback for migration 20260902192310.
-- This rollback refuses to run after financial requests or cheque uploads exist.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if exists (select 1 from public.account_deposit_requests) then
    raise exception
      'Rollback stopped: account deposit records exist and require manual reconciliation';
  end if;

  if exists (
    select 1 from storage.objects where bucket_id = 'cheque-deposits'
  ) then
    raise exception
      'Rollback stopped: cheque files exist and must be archived first';
  end if;
end;
$$;

drop policy if exists cheque_deposits_owner_read on storage.objects;
drop policy if exists cheque_deposits_owner_insert on storage.objects;
drop policy if exists cheque_deposits_owner_delete on storage.objects;
delete from storage.buckets where id = 'cheque-deposits';

drop trigger if exists account_deposit_requests_notify
  on public.account_deposit_requests;
drop trigger if exists account_deposit_requests_review
  on public.account_deposit_requests;
drop trigger if exists account_deposit_requests_set_reference
  on public.account_deposit_requests;

drop function if exists private.notify_account_deposit_status();
drop function if exists private.handle_account_deposit_review();
drop function if exists private.set_account_deposit_reference();
drop function if exists public.submit_account_deposit_request(uuid, text, numeric, uuid, text);

drop index if exists public.transactions_account_deposit_id_idx;
alter table public.transactions drop constraint transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (
  type in (
    'fixed_deposit_funding',
    'fixed_deposit_payout',
    'loan_disbursement',
    'loan_repayment'
  )
);
alter table public.transactions drop column account_deposit_id;

drop table public.account_deposit_requests;
drop type public.account_deposit_method_enum;

commit;
