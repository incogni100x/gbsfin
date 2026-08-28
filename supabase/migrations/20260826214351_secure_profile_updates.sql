drop policy profiles_owner_update on public.profiles;

create policy profiles_owner_update
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

revoke update (onboarding_status)
on public.profiles
from authenticated;

create or replace function public.submit_onboarding()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if (
    select count(*)
    from public.user_security_answers
    where user_id = v_user_id
  ) <> 3 then
    raise exception 'Exactly three security answers are required';
  end if;

  if (
    select count(*)
    from public.user_accounts
    where user_id = v_user_id
  ) <> 3 then
    raise exception 'Exactly three accounts are required';
  end if;

  if exists (
    select 1
    from public.profiles
    where id = v_user_id
      and (
        id_document_path is null
        or proof_of_residence_path is null
      )
  ) then
    raise exception 'Both identity documents are required';
  end if;

  update public.profiles
  set onboarding_status = 'submitted'
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found';
  end if;
end;
$$;

revoke all on function public.submit_onboarding()
from public, anon;

grant execute on function public.submit_onboarding()
to authenticated;
