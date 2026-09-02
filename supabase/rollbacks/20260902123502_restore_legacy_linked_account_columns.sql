-- Manual rollback for migration 20260902123502.
-- Run only after explicit approval and coordinate it with the matching app rollback.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.linked_bank_accounts
  add column account_holder_name text,
  add column iban text,
  add column swift_code text,
  add column country_code text not null default 'US',
  add column currency_code text not null default 'USD';

update public.linked_bank_accounts as account
set
  account_holder_name = account.account_name,
  country_code = 'US',
  currency_code = 'USD';

update public.linked_bank_accounts as account
set
  account_holder_name = archive.account_holder_name,
  iban = archive.iban,
  swift_code = archive.swift_code,
  country_code = archive.country_code,
  currency_code = archive.currency_code
from private.linked_bank_account_legacy_fields as archive
where archive.account_id = account.id;

alter table public.linked_bank_accounts
  alter column account_holder_name set not null;

alter table public.linked_bank_accounts
  add constraint linked_bank_accounts_account_holder_name_check
    check (length(btrim(account_holder_name)) between 2 and 120),
  add constraint linked_bank_accounts_country_code_check
    check (country_code ~ '^[A-Z]{2}$'),
  add constraint linked_bank_accounts_currency_code_check
    check (currency_code ~ '^[A-Z]{3,4}$');

drop table private.linked_bank_account_legacy_fields;

commit;
