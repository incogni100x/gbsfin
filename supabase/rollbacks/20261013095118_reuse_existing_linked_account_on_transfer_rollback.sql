begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

create or replace function public.create_linked_account_and_submit_bank_transfer(
  p_source_account_id uuid,
  p_transfer_type text,
  p_amount numeric,
  p_account_type text,
  p_account_name text,
  p_bank_name text,
  p_account_number text,
  p_routing_number text,
  p_address text
)
returns public.bank_transfers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_transfer_type text := lower(btrim(coalesce(p_transfer_type, '')));
  v_linked_account_id uuid;
  v_transfer public.bank_transfers;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;
  if v_transfer_type not in ('domestic', 'international') then
    raise exception 'Choose Domestic or International transfer';
  end if;
  if lower(btrim(coalesce(p_account_type, ''))) not in ('personal', 'business') then
    raise exception 'Choose Personal or Business account';
  end if;
  if length(btrim(coalesce(p_account_name, ''))) not between 2 and 80 then
    raise exception 'Enter a valid account name';
  end if;
  if length(btrim(coalesce(p_bank_name, ''))) not between 2 and 120 then
    raise exception 'Enter a valid bank name';
  end if;
  if length(btrim(coalesce(p_account_number, ''))) not between 4 and 64 then
    raise exception 'Enter a valid account number';
  end if;
  if nullif(btrim(coalesce(p_routing_number, '')), '') is null then
    raise exception 'Enter a routing number';
  end if;
  if length(btrim(coalesce(p_address, ''))) not between 5 and 240 then
    raise exception 'Enter a valid address';
  end if;

  insert into public.linked_bank_accounts (
    user_id, account_type, account_name, bank_name, account_number,
    routing_number, address, transfer_scope
  ) values (
    v_user_id, lower(btrim(p_account_type)), btrim(p_account_name),
    btrim(p_bank_name), btrim(p_account_number), btrim(p_routing_number),
    btrim(p_address),
    v_transfer_type::public.linked_bank_account_scope_enum
  )
  returning id into v_linked_account_id;

  select transfer.* into v_transfer
  from public.submit_bank_transfer(
    p_source_account_id, 'linked_account', v_linked_account_id, p_amount
  ) as transfer;

  return v_transfer;
end;
$$;

revoke all on function public.create_linked_account_and_submit_bank_transfer(
  uuid, text, numeric, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_linked_account_and_submit_bank_transfer(
  uuid, text, numeric, text, text, text, text, text, text
) to authenticated, service_role;

commit;
