create table private.security_answer_attempts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  failed_attempts smallint not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  constraint security_answer_attempts_failed_attempts_nonnegative
    check (failed_attempts >= 0)
);

revoke all on private.security_answer_attempts from public, anon, authenticated;

create or replace function public.set_security_answers(p_answers jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := private.current_session_id();
  v_answer_count integer;
  v_distinct_question_count integer;
  v_has_existing_answers boolean;
  v_onboarding_status text;
begin
  if v_user_id is null or v_session_id is null then
    raise exception 'Authentication required';
  end if;

  select profile.onboarding_status
  into v_onboarding_status
  from public.profiles as profile
  where profile.id = v_user_id;

  if v_onboarding_status is null then
    raise exception 'Profile not found';
  end if;

  select exists (
    select 1
    from public.user_security_answers
    where user_id = v_user_id
  )
  into v_has_existing_answers;

  if v_has_existing_answers
    and not public.is_current_session_verified()
  then
    raise exception 'A verified session is required to change security answers';
  end if;

  if not v_has_existing_answers
    and v_onboarding_status not in ('pending', 'in_progress', 'submitted')
  then
    raise exception 'Security answers can only be initialized during onboarding';
  end if;

  if jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Security answers must be an array';
  end if;

  select
    count(*),
    count(distinct answer ->> 'question_id')
  into v_answer_count, v_distinct_question_count
  from jsonb_array_elements(p_answers) as answer;

  if v_answer_count <> 3 or v_distinct_question_count <> 3 then
    raise exception 'Exactly three distinct security questions are required';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_answers) as answer
    left join public.security_questions as question
      on question.id = answer ->> 'question_id'
      and question.is_active
    where question.id is null
      or answer ->> 'answer' is null
      or length(btrim(answer ->> 'answer')) < 2
  ) then
    raise exception 'Each security question and answer must be valid';
  end if;

  delete from public.user_security_answers
  where user_id = v_user_id;

  insert into public.user_security_answers (user_id, question_id, answer_hash)
  select
    v_user_id,
    answer ->> 'question_id',
    extensions.crypt(
      lower(btrim(answer ->> 'answer')),
      extensions.gen_salt('bf', 12)
    )
  from jsonb_array_elements(p_answers) as answer;

  insert into private.auth_session_verifications (session_id, user_id)
  values (v_session_id, v_user_id)
  on conflict (session_id) do update
  set
    user_id = excluded.user_id,
    verified_at = now();
end;
$$;

create or replace function public.verify_security_answer(
  p_question_id text,
  p_answer text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid := private.current_session_id();
  v_answer_hash text;
  v_attempts private.security_answer_attempts%rowtype;
  v_now timestamptz := now();
begin
  if v_user_id is null or v_session_id is null then
    return false;
  end if;

  select *
  into v_attempts
  from private.security_answer_attempts
  where user_id = v_user_id
  for update;

  if v_attempts.locked_until is not null
    and v_attempts.locked_until > v_now
  then
    return false;
  end if;

  select answer_hash
  into v_answer_hash
  from public.user_security_answers
  where user_id = v_user_id
    and question_id = p_question_id;

  if p_answer is null
    or length(btrim(p_answer)) < 2
    or v_answer_hash is null
    or extensions.crypt(lower(btrim(p_answer)), v_answer_hash)
      is distinct from v_answer_hash
  then
    insert into private.security_answer_attempts (
      user_id,
      failed_attempts,
      window_started_at,
      locked_until,
      updated_at
    )
    values (v_user_id, 1, v_now, null, v_now)
    on conflict (user_id) do update
    set
      failed_attempts = case
        when private.security_answer_attempts.window_started_at
          < v_now - interval '15 minutes'
          then 1
        else private.security_answer_attempts.failed_attempts + 1
      end,
      window_started_at = case
        when private.security_answer_attempts.window_started_at
          < v_now - interval '15 minutes'
          then v_now
        else private.security_answer_attempts.window_started_at
      end,
      locked_until = case
        when private.security_answer_attempts.window_started_at
          >= v_now - interval '15 minutes'
          and private.security_answer_attempts.failed_attempts + 1 >= 5
          then v_now + interval '15 minutes'
        else null
      end,
      updated_at = v_now;

    return false;
  end if;

  delete from private.security_answer_attempts
  where user_id = v_user_id;

  insert into private.auth_session_verifications (session_id, user_id)
  values (v_session_id, v_user_id)
  on conflict (session_id) do update
  set
    user_id = excluded.user_id,
    verified_at = now();

  return true;
end;
$$;

create or replace function public.open_account(
  p_account_type_id smallint,
  p_currency_code text default 'USD'
)
returns public.user_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_currency_code text := upper(btrim(p_currency_code));
  v_account public.user_accounts;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_current_session_verified() then
    raise exception 'A verified session is required to open an account';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
  ) then
    raise exception 'Profile not found';
  end if;

  if not exists (
    select 1
    from public.account_types
    where id = p_account_type_id
      and is_active
  ) then
    raise exception 'Invalid account type';
  end if;

  if v_currency_code !~ '^[A-Z]{3,4}$' then
    raise exception 'Invalid currency code';
  end if;

  insert into public.user_accounts (
    user_id,
    account_type_id,
    account_number,
    currency_code
  )
  values (
    v_user_id,
    p_account_type_id,
    nextval('public.account_number_seq')::text,
    v_currency_code
  )
  on conflict on constraint user_accounts_user_type_currency_key
  do update set user_id = excluded.user_id
  returning * into v_account;

  return v_account;
end;
$$;
