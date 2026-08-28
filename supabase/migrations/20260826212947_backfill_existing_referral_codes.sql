alter table private.referral_codes
add column owner_user_id uuid
  references public.profiles (id)
  on delete cascade;

create unique index referral_codes_owner_user_id_key
on private.referral_codes (owner_user_id)
where owner_user_id is not null;

alter table public.profiles
add column referred_by_code text;

update public.profiles
set referral_code = nullif(upper(btrim(referral_code)), '');

create unique index profiles_referral_code_key
on public.profiles (referral_code)
where referral_code is not null;

insert into private.referral_codes (code, owner_user_id)
select profile.referral_code, profile.id
from public.profiles as profile
where profile.referral_code is not null
on conflict (code) do update
set owner_user_id = excluded.owner_user_id;

alter table public.profiles
add constraint profiles_referred_by_code_fkey
foreign key (referred_by_code)
references private.referral_codes (code)
on update cascade
on delete set null;

create or replace function private.normalize_profile_referral_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.referral_code := nullif(upper(btrim(new.referral_code)), '');

  return new;
end;
$$;

create or replace function private.sync_profile_referral_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin

  if new.referral_code is null then
    delete from private.referral_codes
    where owner_user_id = new.id;

    return new;
  end if;

  insert into private.referral_codes (code, owner_user_id)
  values (new.referral_code, new.id)
  on conflict (owner_user_id) where owner_user_id is not null
  do update set code = excluded.code;

  return new;
end;
$$;

create trigger profiles_sync_referral_code
after insert or update of referral_code on public.profiles
for each row execute function private.sync_profile_referral_code();

create trigger profiles_normalize_referral_code
before insert or update of referral_code on public.profiles
for each row execute function private.normalize_profile_referral_code();

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
          and referral.owner_user_id is distinct from auth.uid()
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

  select profile.referred_by_code
  into v_existing_code
  from public.profiles as profile
  where profile.id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_existing_code is not null then
    if v_existing_code = v_code then
      return;
    end if;

    raise exception 'A referral code has already been applied';
  end if;

  update private.referral_codes as referral
  set use_count = referral.use_count + 1
  where referral.code = v_code
    and referral.owner_user_id is distinct from v_user_id
    and referral.is_active
    and (referral.expires_at is null or referral.expires_at > now())
    and (referral.max_uses is null or referral.use_count < referral.max_uses);

  if not found then
    raise exception 'The referral code is invalid or no longer available';
  end if;

  update public.profiles
  set referred_by_code = v_code
  where id = v_user_id;
end;
$$;
