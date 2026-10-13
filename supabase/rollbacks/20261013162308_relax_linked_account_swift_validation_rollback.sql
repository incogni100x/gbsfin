begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.linked_bank_accounts
  drop constraint if exists linked_bank_accounts_transfer_code_check,
  add constraint linked_bank_accounts_transfer_code_check check (
    (
      transfer_scope = 'domestic'
      and nullif(btrim(routing_number), '') is not null
      and nullif(btrim(swift_code), '') is null
    )
    or
    (
      transfer_scope = 'international'
      and nullif(btrim(routing_number), '') is null
      and upper(btrim(swift_code)) ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'
    )
  ) not valid;

alter table public.bank_transfers
  drop constraint if exists bank_transfers_recipient_code_check,
  add constraint bank_transfers_recipient_code_check check (
    transfer_type = 'between_accounts'
    or (transfer_type = 'domestic' and recipient_swift_code is null)
    or (
      transfer_type = 'international'
      and nullif(btrim(recipient_routing_number), '') is null
      and upper(btrim(recipient_swift_code)) ~ '^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$'
    )
  ) not valid;

comment on column public.linked_bank_accounts.swift_code is
  'Required 8 or 11 character SWIFT/BIC code for international linked bank accounts.';

commit;
