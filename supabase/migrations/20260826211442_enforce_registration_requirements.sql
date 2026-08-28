create table private.referral_codes (
  code text primary key,
  is_active boolean not null default true,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint referral_codes_code_format_check
    check (
      code = upper(btrim(code))
      and length(code) between 3 and 64
    ),
  constraint referral_codes_max_uses_positive_check
    check (max_uses is null or max_uses > 0),
  constraint referral_codes_use_count_nonnegative_check
    check (use_count >= 0),
  constraint referral_codes_use_count_within_limit_check
    check (max_uses is null or use_count <= max_uses)
);

revoke all on private.referral_codes from public, anon, authenticated;

create or replace function public.validate_referral_code(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and (
      p_code is null
      or btrim(p_code) = ''
      or exists (
        select 1
        from private.referral_codes as referral
        where referral.code = upper(btrim(p_code))
          and referral.is_active
          and (
            referral.expires_at is null
            or referral.expires_at > now()
          )
          and (
            referral.max_uses is null
            or referral.use_count < referral.max_uses
          )
      )
    );
$$;

create or replace function public.apply_referral_code(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_existing_code text;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_code = '' then
    return;
  end if;

  select profile.referral_code
  into v_existing_code
  from public.profiles as profile
  where profile.id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_existing_code is not null then
    if upper(btrim(v_existing_code)) = v_code then
      return;
    end if;

    raise exception 'A referral code has already been applied';
  end if;

  update private.referral_codes as referral
  set use_count = referral.use_count + 1
  where referral.code = v_code
    and referral.is_active
    and (referral.expires_at is null or referral.expires_at > now())
    and (referral.max_uses is null or referral.use_count < referral.max_uses);

  if not found then
    raise exception 'The referral code is invalid or no longer available';
  end if;

  update public.profiles
  set referral_code = v_code
  where id = v_user_id;
end;
$$;

create or replace function public.open_accounts(
  p_account_type_ids integer[],
  p_currency_code text default 'USD'
)
returns setof public.user_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency_code text := upper(btrim(p_currency_code));
  v_requested_count integer;
  v_distinct_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required to open accounts';
  end if;

  select count(*), count(distinct account_type_id)
  into v_requested_count, v_distinct_count
  from unnest(coalesce(p_account_type_ids, array[]::integer[]))
    as requested(account_type_id);

  if v_requested_count <> 3 or v_distinct_count <> 3 then
    raise exception 'Exactly three distinct account types are required';
  end if;

  if (
    select count(*)
    from public.account_types as account_type
    where account_type.id = any(p_account_type_ids)
      and account_type.is_active
  ) <> 3 then
    raise exception 'Every selected account type must be active and valid';
  end if;

  if v_currency_code !~ '^[A-Z]{3,4}$' then
    raise exception 'Invalid currency code';
  end if;

  return query
  insert into public.user_accounts (
    user_id,
    account_type_id,
    account_number,
    currency_code
  )
  select
    v_user_id,
    requested.account_type_id::smallint,
    nextval('public.account_number_seq')::text,
    v_currency_code
  from unnest(p_account_type_ids) as requested(account_type_id)
  on conflict on constraint user_accounts_user_type_currency_key
  do update set user_id = excluded.user_id
  returning *;
end;
$$;

revoke update (referral_code) on public.profiles from authenticated;

revoke all on function public.validate_referral_code(text)
  from public, anon;
revoke all on function public.apply_referral_code(text)
  from public, anon;
revoke all on function public.open_accounts(integer[], text)
  from public, anon;

grant execute on function public.validate_referral_code(text)
  to authenticated;
grant execute on function public.apply_referral_code(text)
  to authenticated;
grant execute on function public.open_accounts(integer[], text)
  to authenticated;
