begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop trigger if exists bank_transfers_enforce_approval on public.bank_transfers;
drop function if exists private.enforce_bank_transfer_approval();

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
      case when new.status = 'pending' then 'Escrow transfer submitted' else 'Transfer complete' end,
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
      case new.status when 'completed' then 'Escrow transfer approved' else 'Escrow transfer rejected' end,
      format('%s was %s.', new.application_reference, new.status::text)
    );
  end if;
  return new;
end;
$$;

commit;
