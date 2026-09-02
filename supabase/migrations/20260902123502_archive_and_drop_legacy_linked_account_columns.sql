set local lock_timeout = '5s';
set local statement_timeout = '30s';

create table private.linked_bank_account_legacy_fields (
  account_id uuid primary key
    references public.linked_bank_accounts (id) on delete cascade,
  account_holder_name text not null,
  iban text,
  swift_code text,
  country_code text not null,
  currency_code text not null,
  archived_at timestamptz not null default now()
);

comment on table private.linked_bank_account_legacy_fields is
  'Temporary rollback archive for linked bank account columns removed in migration 20260902123502.';

alter table private.linked_bank_account_legacy_fields enable row level security;
revoke all on table private.linked_bank_account_legacy_fields
  from public, anon, authenticated;

insert into private.linked_bank_account_legacy_fields (
  account_id,
  account_holder_name,
  iban,
  swift_code,
  country_code,
  currency_code
)
select
  id,
  account_holder_name,
  iban,
  swift_code,
  country_code,
  currency_code
from public.linked_bank_accounts;

alter table public.linked_bank_accounts
  drop column if exists account_holder_name,
  drop column if exists iban,
  drop column if exists swift_code,
  drop column if exists country_code,
  drop column if exists currency_code;
