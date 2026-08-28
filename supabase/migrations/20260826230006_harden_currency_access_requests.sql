create policy currency_access_requests_owner_insert
on public.currency_access_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and review_note is null
  and reviewed_at is null
  and currency_code <> 'USD'
  and exists (
    select 1
    from public.currencies as currency
    where currency.code = currency_access_requests.currency_code
      and currency.is_active
  )
  and (select public.is_current_session_verified())
);

create policy currency_access_requests_owner_reapply
on public.currency_access_requests
for update
to authenticated
using (
  (select auth.uid()) = user_id
  and status = 'rejected'
  and (select public.is_current_session_verified())
)
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and currency_code <> 'USD'
  and (select public.is_current_session_verified())
);

grant insert (user_id, currency_code)
on public.currency_access_requests
to authenticated;

grant update (status)
on public.currency_access_requests
to authenticated;

create or replace function private.handle_currency_request_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'pending' then
      new.reviewed_at = null;
      new.review_note = null;
    else
      new.reviewed_at = now();
    end if;
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.user_currency_balances (user_id, currency_code)
    values (new.user_id, new.currency_code)
    on conflict (user_id, currency_code) do nothing;
  end if;

  return new;
end;
$$;

create or replace function public.request_currency_access(p_currency_code text)
returns public.currency_access_requests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency_code text := upper(btrim(p_currency_code));
  v_request public.currency_access_requests;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required';
  end if;

  if v_currency_code = 'USD' or not exists (
    select 1
    from public.currencies as currency
    where currency.code = v_currency_code
      and currency.is_active
  ) then
    raise exception 'This currency cannot be requested';
  end if;

  select request.*
  into v_request
  from public.currency_access_requests as request
  where request.user_id = v_user_id
    and request.currency_code = v_currency_code;

  if found then
    if v_request.status = 'rejected' then
      update public.currency_access_requests
      set status = 'pending'
      where id = v_request.id
      returning * into v_request;
    end if;

    return v_request;
  end if;

  insert into public.currency_access_requests (user_id, currency_code)
  values (v_user_id, v_currency_code)
  returning * into v_request;

  return v_request;
end;
$$;
