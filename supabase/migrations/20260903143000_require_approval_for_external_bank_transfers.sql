begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function private.enforce_bank_transfer_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_type text;
  v_destination_type text;
begin
  select account_type.name into v_source_type
  from public.user_accounts as account
  join public.account_types as account_type on account_type.id = account.account_type_id
  where account.id = new.source_account_id;

  if new.destination_kind = 'own_account' then
    select account_type.name into v_destination_type
    from public.user_accounts as account
    join public.account_types as account_type on account_type.id = account.account_type_id
    where account.id = new.destination_account_id;
  end if;

  new.status := case
    when new.destination_kind <> 'own_account'
      or lower(coalesce(v_source_type, '')) = 'escrow'
      or lower(coalesce(v_destination_type, '')) = 'escrow'
    then 'pending'::public.bank_transfer_status_enum
    else 'completed'::public.bank_transfer_status_enum
  end;
  return new;
end;
$$;

revoke all on function private.enforce_bank_transfer_approval()
  from public, anon, authenticated, service_role;

create trigger bank_transfers_enforce_approval
before insert on public.bank_transfers
for each row execute function private.enforce_bank_transfer_approval();

create or replace function private.notify_bank_transfer_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id, type, title, message)
    values (
      new.user_id,
      'transaction',
      case when new.status = 'pending' then 'Bank transfer submitted' else 'Transfer complete' end,
      case when new.status = 'pending'
        then format('%s is pending approval.', new.application_reference)
        else format('%s was completed.', new.application_reference)
      end
    );
  elsif new.status is distinct from old.status then
    insert into public.notifications(user_id, type, title, message)
    values (
      new.user_id,
      'transaction',
      case new.status when 'completed' then 'Bank transfer approved' else 'Bank transfer rejected' end,
      format('%s was %s.', new.application_reference, new.status::text)
    );
  end if;
  return new;
end;
$$;

commit;
