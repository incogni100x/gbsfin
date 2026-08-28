alter table public.currency_withdrawals
add column submitted_at timestamptz;

update public.currency_withdrawals
set submitted_at = created_at;

alter table public.currency_withdrawals
alter column submitted_at set default now(),
alter column submitted_at set not null;

comment on column public.currency_withdrawals.submitted_at is
  'Immutable original submission timestamp. Review-date backdating does not overwrite it.';

drop trigger currency_withdrawals_set_updated_at
on public.currency_withdrawals;

create or replace function private.handle_currency_withdrawal_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance_update_count integer;
begin
  if new.user_id is distinct from old.user_id
    or new.currency_code is distinct from old.currency_code
    or new.amount is distinct from old.amount
  then
    raise exception 'A withdrawal owner, currency, and amount cannot be changed';
  end if;

  if new.submitted_at is distinct from old.submitted_at then
    raise exception 'The original submission timestamp cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'pending' then
      raise exception 'A reviewed withdrawal cannot return to pending';
    end if;

    if new.status = 'rejected' and old.status <> 'rejected' then
      update public.user_currency_balances
      set balance = balance + new.amount
      where user_id = new.user_id
        and currency_code = new.currency_code;

      if not found then
        raise exception 'The reserved currency balance could not be refunded';
      end if;
    elsif new.status = 'approved' and old.status = 'rejected' then
      update public.user_currency_balances
      set balance = balance - new.amount
      where user_id = new.user_id
        and currency_code = new.currency_code
        and balance >= new.amount;

      get diagnostics v_balance_update_count = row_count;

      if v_balance_update_count <> 1 then
        raise exception 'The withdrawal cannot be approved because the refunded balance is insufficient';
      end if;
    end if;

    new.reviewed_at = coalesce(new.reviewed_at, now());
    new.refunded_at = case
      when new.status = 'rejected'
        then coalesce(new.refunded_at, new.reviewed_at)
      else null
    end;
  end if;

  if new.reviewed_at is distinct from old.reviewed_at then
    if new.status = 'pending' then
      raise exception 'A pending withdrawal cannot have a review date';
    end if;

    new.created_at = new.reviewed_at;
    new.updated_at = new.reviewed_at;

    if new.status = 'rejected' then
      new.refunded_at = new.reviewed_at;
    end if;
  elsif new.updated_at is not distinct from old.updated_at then
    new.updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function private.handle_currency_withdrawal_review()
from public, anon, authenticated;

create trigger currency_withdrawals_review
before update on public.currency_withdrawals
for each row execute function private.handle_currency_withdrawal_review();

create or replace function public.review_currency_withdrawal(
  p_withdrawal_id uuid,
  p_status text,
  p_review_note text default null
)
returns public.currency_withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := lower(btrim(p_status));
  v_withdrawal public.currency_withdrawals;
begin
  if v_status not in ('approved', 'rejected') then
    raise exception 'Review status must be approved or rejected';
  end if;

  select withdrawal.*
  into v_withdrawal
  from public.currency_withdrawals as withdrawal
  where withdrawal.id = p_withdrawal_id
  for update;

  if not found then
    raise exception 'Withdrawal request was not found';
  end if;

  if v_withdrawal.status <> 'pending' then
    raise exception 'Only pending withdrawal requests can be reviewed';
  end if;

  update public.currency_withdrawals
  set
    status = v_status::public.request_status,
    review_note = nullif(btrim(p_review_note), '')
  where id = p_withdrawal_id
  returning * into v_withdrawal;

  return v_withdrawal;
end;
$$;

revoke all on function public.review_currency_withdrawal(uuid, text, text)
from public, anon, authenticated;
grant execute on function public.review_currency_withdrawal(uuid, text, text)
to service_role;
