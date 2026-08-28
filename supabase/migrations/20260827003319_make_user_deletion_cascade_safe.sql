alter table public.currency_transfers
drop constraint currency_transfers_destination_account_id_fkey;

alter table public.currency_transfers
add constraint currency_transfers_destination_account_id_fkey
foreign key (destination_account_id)
references public.user_accounts (id)
on delete cascade;
