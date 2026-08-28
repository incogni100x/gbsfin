create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create extension if not exists pgcrypto with schema extensions;

create table public.account_types (
  id smallint primary key,
  name text not null unique,
  description text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint account_types_id_positive check (id > 0)
);

create table public.security_questions (
  id text primary key,
  question text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone_number text,
  referral_code text,
  onboarding_status text not null default 'pending',
  id_document_path text,
  proof_of_residence_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_onboarding_status_check
    check (onboarding_status in ('pending', 'in_progress', 'submitted', 'approved', 'rejected'))
);

create sequence public.account_number_seq
  as bigint
  start with 1000000000
  increment by 1
  minvalue 1000000000
  maxvalue 9999999999
  no cycle;

create table public.user_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_type_id smallint not null references public.account_types (id),
  account_number text not null unique,
  currency_code text not null default 'USD',
  balance numeric(20, 2) not null default 0,
  created_at timestamptz not null default now(),
  constraint user_accounts_balance_nonnegative check (balance >= 0),
  constraint user_accounts_currency_code_check check (currency_code ~ '^[A-Z]{3,4}$'),
  constraint user_accounts_user_type_currency_key
    unique (user_id, account_type_id, currency_code)
);

create index user_accounts_user_id_idx
  on public.user_accounts (user_id);

create index user_accounts_account_type_id_idx
  on public.user_accounts (account_type_id);

create table public.user_security_answers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id text not null references public.security_questions (id),
  answer_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create index user_security_answers_question_id_idx
  on public.user_security_answers (question_id);

create table private.auth_session_verifications (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  verified_at timestamptz not null default now()
);

create index auth_session_verifications_user_id_idx
  on private.auth_session_verifications (user_id);

insert into public.account_types (id, name, description)
values
  (1, 'Savings', 'Standard savings account'),
  (2, 'Checking', 'Everyday checking account'),
  (3, 'Fixed', 'Designed for long-term savings'),
  (4, 'Offshore', 'International account for global operations'),
  (5, 'Business Checking', 'Everyday business checking account')
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true;

insert into public.security_questions (id, question)
values
  ('favorite_color', 'What is your favorite color?'),
  ('favorite_food', 'What is your favorite food?'),
  ('birth_city', 'In what city were you born?'),
  ('mother_maiden_name', 'What is your mother''s maiden name?'),
  ('favorite_pet_name', 'What is the name of your favorite pet?'),
  ('high_school_attended', 'What high school did you attend?'),
  ('first_school_name', 'What was the name of your first school?'),
  ('first_car_make', 'What was the make of your first car?'),
  ('childhood_favorite_food', 'What was your favorite food as a child?')
on conflict (id) do update
set
  question = excluded.question,
  is_active = true;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger user_security_answers_set_updated_at
before update on public.user_security_answers
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    first_name,
    last_name,
    phone_number,
    onboarding_status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone_number', ''),
    'in_progress'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.current_session_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

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
begin
  if v_user_id is null then
    raise exception 'Authentication required';
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

  if v_session_id is not null then
    insert into private.auth_session_verifications (session_id, user_id)
    values (v_session_id, v_user_id)
    on conflict (session_id) do update
    set
      user_id = excluded.user_id,
      verified_at = now();
  end if;
end;
$$;

create or replace function public.get_security_question()
returns table (question_id text, question text)
language sql
stable
security definer
set search_path = ''
as $$
  select security_question.id, security_question.question
  from public.user_security_answers as user_answer
  join public.security_questions as security_question
    on security_question.id = user_answer.question_id
  where user_answer.user_id = auth.uid()
    and security_question.is_active
  order by md5(security_question.id || auth.uid()::text || current_date::text)
  limit 1;
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
begin
  if v_user_id is null or v_session_id is null then
    return false;
  end if;

  select answer_hash
  into v_answer_hash
  from public.user_security_answers
  where user_id = v_user_id
    and question_id = p_question_id;

  if v_answer_hash is null then
    return false;
  end if;

  if extensions.crypt(lower(btrim(p_answer)), v_answer_hash) <> v_answer_hash then
    return false;
  end if;

  insert into private.auth_session_verifications (session_id, user_id)
  values (v_session_id, v_user_id)
  on conflict (session_id) do update
  set
    user_id = excluded.user_id,
    verified_at = now();

  return true;
end;
$$;

create or replace function public.is_current_session_verified()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.auth_session_verifications as verification
    where verification.session_id = private.current_session_id()
      and verification.user_id = auth.uid()
  );
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

alter table public.account_types enable row level security;
alter table public.security_questions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_accounts enable row level security;
alter table public.user_security_answers enable row level security;
alter table private.auth_session_verifications enable row level security;

create policy account_types_authenticated_read
on public.account_types
for select
to authenticated
using (is_active);

create policy security_questions_authenticated_read
on public.security_questions
for select
to authenticated
using (is_active);

create policy profiles_owner_read
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_owner_update
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check (
  (select auth.uid()) = id
  and onboarding_status in ('in_progress', 'submitted')
);

create policy user_accounts_owner_read
on public.user_accounts
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

grant select on public.account_types to authenticated;
grant select on public.security_questions to authenticated;
grant select on public.profiles to authenticated;
grant update (
  first_name,
  last_name,
  phone_number,
  referral_code,
  onboarding_status,
  id_document_path,
  proof_of_residence_path
) on public.profiles to authenticated;
grant select on public.user_accounts to authenticated;

revoke all on public.user_security_answers from public, anon, authenticated;
revoke all on private.auth_session_verifications from public, anon, authenticated;
revoke all on sequence public.account_number_seq from public, anon, authenticated;

revoke all on function public.set_security_answers(jsonb) from public, anon;
revoke all on function public.get_security_question() from public, anon;
revoke all on function public.verify_security_answer(text, text) from public, anon;
revoke all on function public.is_current_session_verified() from public, anon;
revoke all on function public.open_account(smallint, text) from public, anon;

grant execute on function public.set_security_answers(jsonb) to authenticated;
grant execute on function public.get_security_question() to authenticated;
grant execute on function public.verify_security_answer(text, text) to authenticated;
grant execute on function public.is_current_session_verified() to authenticated;
grant execute on function public.open_account(smallint, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'identity-documents',
  'identity-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy identity_documents_owner_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy identity_documents_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy identity_documents_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
