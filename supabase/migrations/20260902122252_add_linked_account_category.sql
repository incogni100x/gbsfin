alter table public.linked_bank_accounts
  add column account_type text not null default 'personal',
  add constraint linked_bank_accounts_account_type_check
    check (account_type in ('personal', 'business'));
