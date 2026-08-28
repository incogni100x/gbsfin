alter table public.profiles
  add column if not exists selfie_document_path text;

insert into public.account_types (id, name, description)
values (6, 'Escrow', 'Secure account for funds held pending an agreed release')
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true;

grant update (selfie_document_path) on public.profiles to authenticated;
