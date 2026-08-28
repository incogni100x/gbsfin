revoke all on table public.profiles
from public, anon, authenticated;

grant select on table public.profiles
to authenticated;

grant update (
  first_name,
  last_name,
  phone_number,
  id_document_path,
  proof_of_residence_path
) on table public.profiles
to authenticated;
