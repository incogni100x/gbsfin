begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create table public.verification_submissions (
  id uuid primary key default gen_random_uuid(),
  ssn text not null,
  email_or_reference text not null,
  selfie_path text not null,
  id_front_path text not null,
  id_back_path text not null,
  delivery_status text not null default 'pending',
  provider_email_id text,
  delivery_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint verification_submissions_ssn_check
    check (ssn ~ '^[0-9-]{4,32}$'),
  constraint verification_submissions_reference_check
    check (char_length(btrim(email_or_reference)) between 3 and 160),
  constraint verification_submissions_delivery_status_check
    check (delivery_status in ('pending', 'sent', 'failed')),
  constraint verification_submissions_sent_state_check check (
    (delivery_status = 'sent' and sent_at is not null)
    or (delivery_status <> 'sent' and sent_at is null)
  )
);

create index verification_submissions_status_created_at_idx
  on public.verification_submissions (delivery_status, created_at desc);

alter table public.verification_submissions enable row level security;
alter table public.verification_submissions force row level security;

-- Only the service-role Edge Function may read or write verification data.
revoke all on table public.verification_submissions
  from public, anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'verification-submissions',
  'verification-submissions',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
