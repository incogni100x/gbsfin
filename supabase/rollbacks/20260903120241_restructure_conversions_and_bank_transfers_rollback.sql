begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

-- Keep any feature data created after deployment before removing the new
-- schema. These private archives intentionally survive rollback.
create table private.bank_beneficiaries_20260903120241_rollback_archive as
select
  id, user_id, account_type, account_name, bank_name, account_number,
  routing_number, created_at, updated_at, now() as archived_at
from public.bank_beneficiaries;

create table private.bank_transfers_20260903120241_rollback_archive as
select
  id, user_id, source_account_id, destination_kind::text as destination_kind,
  destination_account_id, linked_bank_account_id, beneficiary_id,
  recipient_name, recipient_bank_name, recipient_account_number,
  recipient_routing_number, amount, currency_code, status::text as status,
  review_note, application_reference, created_at, now() as archived_at
from public.bank_transfers;

revoke all on table private.bank_beneficiaries_20260903120241_rollback_archive
  from public, anon, authenticated;
revoke all on table private.bank_transfers_20260903120241_rollback_archive
  from public, anon, authenticated;

drop function public.review_bank_transfer(uuid, text, text);
drop function public.submit_bank_transfer(uuid, text, uuid, numeric);
drop trigger bank_transfers_review on public.bank_transfers;
drop trigger bank_transfers_notify on public.bank_transfers;
drop function private.handle_bank_transfer_review();
drop function private.notify_bank_transfer_status();
drop table public.bank_transfers;
drop table public.bank_beneficiaries;
drop type public.bank_transfer_status_enum;
drop type public.bank_transfer_destination_enum;

drop function public.convert_currency_balance(text, numeric, text);
drop function public.request_currency_transfer(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
);
drop function public.review_currency_transfer(uuid, text, text);
drop trigger currency_transfers_review on public.currency_transfers;
drop function private.handle_currency_transfer_review();

alter table public.currency_transfers rename to currency_withdrawals;
alter table public.currency_withdrawals
  rename constraint currency_transfers_pkey to currency_withdrawals_pkey;
alter table public.currency_withdrawals
  rename constraint currency_transfers_user_id_fkey to currency_withdrawals_user_id_fkey;
alter table public.currency_withdrawals
  rename constraint currency_transfers_currency_code_fkey to currency_withdrawals_currency_code_fkey;
alter table public.currency_withdrawals
  rename constraint currency_transfers_amount_positive to currency_withdrawals_amount_positive;
alter index public.currency_transfers_user_created_at_idx
  rename to currency_withdrawals_user_created_at_idx;
alter index public.currency_transfers_pending_created_at_idx
  rename to currency_withdrawals_pending_created_at_idx;
alter index public.currency_transfers_currency_code_idx
  rename to currency_withdrawals_currency_code_idx;
alter policy currency_transfers_owner_read on public.currency_withdrawals
  rename to currency_withdrawals_owner_read;

alter table public.currency_conversions rename to currency_transfers;
alter table public.currency_transfers
  rename constraint currency_conversions_pkey to currency_transfers_pkey;
alter table public.currency_transfers
  rename constraint currency_conversions_user_id_fkey to currency_transfers_user_id_fkey;
alter table public.currency_transfers
  rename constraint currency_conversions_source_currency_code_fkey to currency_transfers_source_currency_code_fkey;
alter table public.currency_transfers
  rename constraint currency_conversions_destination_currency_code_fkey to currency_transfers_destination_currency_code_fkey;
alter table public.currency_transfers
  rename constraint currency_conversions_destination_account_id_fkey to currency_transfers_destination_account_id_fkey;
alter table public.currency_transfers
  rename constraint currency_conversions_source_account_id_fkey to currency_transfers_source_account_id_fkey;
alter table public.currency_transfers
  rename constraint currency_conversions_source_amount_positive to currency_transfers_source_amount_positive;
alter table public.currency_transfers
  rename constraint currency_conversions_destination_amount_positive to currency_transfers_destination_amount_positive;
alter table public.currency_transfers
  rename constraint currency_conversions_exchange_rate_positive to currency_transfers_exchange_rate_positive;
alter table public.currency_transfers
  rename constraint currency_conversions_status_check to currency_transfers_status_check;
alter table public.currency_transfers
  rename constraint currency_conversions_destination_check to currency_transfers_destination_check;
alter index public.currency_conversions_user_created_at_idx
  rename to currency_transfers_user_created_at_idx;
alter index public.currency_conversions_source_currency_code_idx
  rename to currency_transfers_source_currency_code_idx;
alter index public.currency_conversions_destination_currency_code_idx
  rename to currency_transfers_destination_currency_code_idx;
alter index public.currency_conversions_destination_account_id_idx
  rename to currency_transfers_destination_account_id_idx;
alter index public.currency_conversions_source_account_id_idx
  rename to currency_transfers_source_account_id_idx;
alter policy currency_conversions_owner_read on public.currency_transfers
  rename to currency_transfers_owner_read;

alter function public.transfer_currency_balance_legacy(text, numeric, text, text, uuid)
  rename to transfer_currency_balance;
alter function public.transfer_bank_account_to_usd_balance_legacy(uuid, numeric)
  rename to transfer_bank_account_to_usd_balance;
alter function public.request_currency_withdrawal_legacy(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) rename to request_currency_withdrawal;
alter function public.review_currency_withdrawal_legacy(uuid, text, text)
  rename to review_currency_withdrawal;
alter function private.handle_currency_withdrawal_review_legacy()
  rename to handle_currency_withdrawal_review;

create trigger currency_withdrawals_review
before update on public.currency_withdrawals
for each row execute function private.handle_currency_withdrawal_review();

grant execute on function public.transfer_currency_balance(
  text, numeric, text, text, uuid
) to authenticated, service_role;
grant execute on function public.transfer_bank_account_to_usd_balance(uuid, numeric)
  to authenticated, service_role;
grant execute on function public.request_currency_withdrawal(
  text, numeric, text, text, text, text, text, text,
  text, text, text, text, text, text, text, text
) to authenticated, service_role;
grant execute on function public.review_currency_withdrawal(uuid, text, text)
  to service_role;

comment on table public.currency_transfers is
  'Completed transfers between currency balances and legacy bank/currency balance destinations.';
comment on table public.currency_withdrawals is
  'Pending and reviewed withdrawals from currency balances.';

commit;
