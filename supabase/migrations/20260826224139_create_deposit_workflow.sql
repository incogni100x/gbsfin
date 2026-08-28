create type public.request_status as enum ('pending', 'approved', 'rejected');

create table public.currencies (
  code text primary key,
  name text not null,
  symbol text not null,
  currency_kind text not null,
  display_order smallint not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint currencies_code_format_check
    check (code = upper(code) and code ~ '^[A-Z]{3,4}$'),
  constraint currencies_kind_check
    check (currency_kind in ('fiat', 'stablecoin'))
);

create table public.exchange_rates (
  base_currency_code text not null references public.currencies (code),
  quote_currency_code text not null references public.currencies (code),
  rate numeric(24, 12) not null,
  source text not null,
  effective_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (base_currency_code, quote_currency_code),
  constraint exchange_rates_rate_positive check (rate > 0)
);

create table public.user_currency_balances (
  user_id uuid not null references public.profiles (id) on delete cascade,
  currency_code text not null references public.currencies (code),
  balance numeric(24, 6) not null default 0,
  enabled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, currency_code),
  constraint user_currency_balances_nonnegative check (balance >= 0)
);

create index user_currency_balances_currency_code_idx
  on public.user_currency_balances (currency_code);

create table public.currency_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  currency_code text not null references public.currencies (code),
  status public.request_status not null default 'pending',
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, currency_code)
);

create index currency_access_requests_user_status_idx
  on public.currency_access_requests (user_id, status);

create index currency_access_requests_status_created_at_idx
  on public.currency_access_requests (status, created_at);

create table public.deposit_instructions (
  id uuid primary key default gen_random_uuid(),
  currency_code text not null references public.currencies (code),
  payment_rail text not null,
  beneficiary_name text,
  bank_name text,
  bank_address text,
  account_number text,
  routing_number text,
  iban text,
  swift_bic text,
  sort_code text,
  bsb text,
  clabe text,
  wallet_address text,
  network text,
  payment_reference text,
  is_demo boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (currency_code, payment_rail),
  unique (id, currency_code),
  constraint deposit_instructions_destination_check check (
    account_number is not null
    or iban is not null
    or clabe is not null
    or wallet_address is not null
  )
);

create index deposit_instructions_currency_code_idx
  on public.deposit_instructions (currency_code)
  where is_active;

create table public.deposit_confirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  currency_code text not null references public.currencies (code),
  instruction_id uuid not null,
  amount numeric(24, 6) not null,
  sender_name text not null,
  sender_reference text,
  status public.request_status not null default 'pending',
  review_note text,
  reviewed_at timestamptz,
  credited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposit_confirmations_amount_positive check (amount > 0),
  constraint deposit_confirmations_instruction_currency_fkey
    foreign key (instruction_id, currency_code)
    references public.deposit_instructions (id, currency_code)
);

create index deposit_confirmations_user_created_at_idx
  on public.deposit_confirmations (user_id, created_at desc);

create index deposit_confirmations_status_created_at_idx
  on public.deposit_confirmations (status, created_at);

create index deposit_confirmations_instruction_id_idx
  on public.deposit_confirmations (instruction_id);

insert into public.currencies (code, name, symbol, currency_kind, display_order)
values
  ('USD', 'US Dollar', '$', 'fiat', 1),
  ('EUR', 'Euro', '€', 'fiat', 2),
  ('AUD', 'Australian Dollar', 'A$', 'fiat', 3),
  ('AED', 'UAE Dirham', 'د.إ', 'fiat', 4),
  ('MXN', 'Mexican Peso', 'MX$', 'fiat', 5),
  ('GBP', 'British Pound', '£', 'fiat', 6),
  ('NZD', 'New Zealand Dollar', 'NZ$', 'fiat', 7),
  ('USDC', 'USD Coin', 'USDC', 'stablecoin', 8),
  ('USDT', 'Tether', 'USDT', 'stablecoin', 9);

insert into public.exchange_rates (
  base_currency_code,
  quote_currency_code,
  rate,
  source,
  effective_at
)
values
  ('USD', 'USD', 1, 'Identity rate', '2026-08-24 16:00:00+00'),
  ('USD', 'EUR', 0.857338820302, 'ECB reference rates', '2026-08-24 16:00:00+00'),
  ('USD', 'GBP', 0.733453360768, 'ECB reference rates', '2026-08-24 16:00:00+00'),
  ('USD', 'AUD', 1.396347736626, 'ECB reference rates', '2026-08-24 16:00:00+00'),
  ('USD', 'MXN', 16.928240740741, 'ECB reference rates', '2026-08-24 16:00:00+00'),
  ('USD', 'NZD', 1.677554869684, 'ECB reference rates', '2026-08-24 16:00:00+00'),
  ('USD', 'AED', 3.6725, 'Central Bank of the UAE', '2026-08-24 16:00:00+00'),
  ('USD', 'USDC', 1, 'Demo stablecoin parity', '2026-08-24 16:00:00+00'),
  ('USD', 'USDT', 1, 'Demo stablecoin parity', '2026-08-24 16:00:00+00');

insert into public.deposit_instructions (
  currency_code,
  payment_rail,
  beneficiary_name,
  bank_name,
  bank_address,
  account_number,
  routing_number,
  iban,
  swift_bic,
  sort_code,
  bsb,
  clabe,
  wallet_address,
  network,
  payment_reference
)
values
  (
    'USD', 'ACH / Fedwire', 'Global Stripe Fin Demo', 'Demo Federal Bank',
    '100 Demo Avenue, New York, NY 10000, United States', '000123456789',
    '000000000', null, 'DEMOUS00XXX', null, null, null, null, null,
    'Use your Global Stripe Fin profile ID'
  ),
  (
    'EUR', 'SEPA', 'Global Stripe Fin Demo', 'Demo Euro Bank',
    '1 Demo Platz, 10115 Berlin, Germany', null, null,
    'DE00000000000000000000', 'DEMOEUX0XXX', null, null, null, null, null,
    'Use your Global Stripe Fin profile ID'
  ),
  (
    'AUD', 'BECS', 'Global Stripe Fin Demo', 'Demo Australia Bank',
    '1 Demo Street, Sydney NSW 2000, Australia', '000123456', null, null,
    'DEMOAU20XXX', null, '000-000', null, null, null,
    'Use your Global Stripe Fin profile ID'
  ),
  (
    'AED', 'UAEFTS', 'Global Stripe Fin Demo', 'Demo Emirates Bank',
    '1 Demo Road, Dubai, United Arab Emirates', null, null,
    'AE000000000000000000000', 'DEMOAEADXXX', null, null, null, null, null,
    'Use your Global Stripe Fin profile ID'
  ),
  (
    'MXN', 'SPEI', 'Global Stripe Fin Demo', 'Demo México Bank',
    '1 Avenida Demo, Ciudad de México, México', null, null, null,
    'DEMOMXMMXXX', null, null, '000000000000000000', null, null,
    'Use your Global Stripe Fin profile ID'
  ),
  (
    'GBP', 'Faster Payments', 'Global Stripe Fin Demo', 'Demo UK Bank',
    '1 Demo Lane, London, United Kingdom', '00000000', null,
    'GB00DEMO00000000000000', 'DEMOGB20XXX', '00-00-00', null, null, null, null,
    'Use your Global Stripe Fin profile ID'
  ),
  (
    'NZD', 'NZ BECS', 'Global Stripe Fin Demo', 'Demo New Zealand Bank',
    '1 Demo Quay, Wellington, New Zealand', '00-0000-0000000-00', null, null,
    'DEMONZ20XXX', null, null, null, null, null,
    'Use your Global Stripe Fin profile ID'
  ),
  (
    'USDT', 'Tron (TRC20)', null, null, null, null, null, null, null, null,
    null, null, 'TDcCG4odFYy1cx9fMoYnfHeby2fs93EeK6', 'Tron (TRC20)', null
  ),
  (
    'USDC', 'Ethereum (ERC20)', null, null, null, null, null, null, null, null,
    null, null, '0x18341D82921BA3eA32Bec09f47a1802D9751FC68',
    'Ethereum (ERC20)', null
  );

create or replace function private.create_default_currency_balance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_currency_balances (user_id, currency_code)
  values (new.id, 'USD')
  on conflict (user_id, currency_code) do nothing;

  return new;
end;
$$;

create trigger profiles_create_default_currency_balance
after insert on public.profiles
for each row execute function private.create_default_currency_balance();

insert into public.user_currency_balances (user_id, currency_code)
select profile.id, 'USD'
from public.profiles as profile
on conflict (user_id, currency_code) do nothing;

create or replace function public.request_currency_access(p_currency_code text)
returns public.currency_access_requests
language plpgsql
security definer
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

  insert into public.currency_access_requests (
    user_id,
    currency_code,
    status
  )
  values (
    v_user_id,
    v_currency_code,
    'pending'
  )
  on conflict (user_id, currency_code) do update
  set
    status = case
      when currency_access_requests.status = 'rejected' then 'pending'
      else currency_access_requests.status
    end,
    review_note = case
      when currency_access_requests.status = 'rejected' then null
      else currency_access_requests.review_note
    end,
    reviewed_at = case
      when currency_access_requests.status = 'rejected' then null
      else currency_access_requests.reviewed_at
    end
  returning * into v_request;

  return v_request;
end;
$$;

create or replace function private.handle_currency_request_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_at = case when new.status = 'pending' then null else now() end;
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.user_currency_balances (user_id, currency_code)
    values (new.user_id, new.currency_code)
    on conflict (user_id, currency_code) do nothing;
  end if;

  return new;
end;
$$;

create trigger currency_access_requests_review
before update on public.currency_access_requests
for each row execute function private.handle_currency_request_review();

create or replace function private.handle_deposit_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.credited_at is not null and new.status is distinct from old.status then
    raise exception 'A credited deposit cannot change status';
  end if;

  if new.status is distinct from old.status then
    new.reviewed_at = now();
  end if;

  if new.status = 'approved'
    and old.status is distinct from 'approved'
    and old.credited_at is null
  then
    update public.user_currency_balances
    set
      balance = balance + new.amount,
      updated_at = now()
    where user_id = new.user_id
      and currency_code = new.currency_code;

    if not found then
      raise exception 'Currency balance is not enabled for this user';
    end if;

    new.credited_at = now();
  end if;

  return new;
end;
$$;

create trigger deposit_confirmations_review
before update on public.deposit_confirmations
for each row execute function private.handle_deposit_review();

create trigger exchange_rates_set_updated_at
before update on public.exchange_rates
for each row execute function private.set_updated_at();

create trigger user_currency_balances_set_updated_at
before update on public.user_currency_balances
for each row execute function private.set_updated_at();

create trigger currency_access_requests_set_updated_at
before update on public.currency_access_requests
for each row execute function private.set_updated_at();

create trigger deposit_confirmations_set_updated_at
before update on public.deposit_confirmations
for each row execute function private.set_updated_at();

alter table public.currencies enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.user_currency_balances enable row level security;
alter table public.currency_access_requests enable row level security;
alter table public.deposit_instructions enable row level security;
alter table public.deposit_confirmations enable row level security;

create policy currencies_authenticated_read
on public.currencies
for select
to authenticated
using (is_active);

create policy exchange_rates_authenticated_read
on public.exchange_rates
for select
to authenticated
using (true);

create policy user_currency_balances_owner_read
on public.user_currency_balances
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

create policy currency_access_requests_owner_read
on public.currency_access_requests
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

create policy deposit_instructions_approved_currency_read
on public.deposit_instructions
for select
to authenticated
using (
  is_active
  and exists (
    select 1
    from public.user_currency_balances as balance
    where balance.user_id = (select auth.uid())
      and balance.currency_code = deposit_instructions.currency_code
  )
  and (select public.is_current_session_verified())
);

create policy deposit_confirmations_owner_read
on public.deposit_confirmations
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and (select public.is_current_session_verified())
);

create policy deposit_confirmations_owner_insert
on public.deposit_confirmations
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and credited_at is null
  and review_note is null
  and reviewed_at is null
  and exists (
    select 1
    from public.user_currency_balances as balance
    where balance.user_id = (select auth.uid())
      and balance.currency_code = deposit_confirmations.currency_code
  )
  and (select public.is_current_session_verified())
);

grant select on public.currencies to authenticated;
grant select on public.exchange_rates to authenticated;
grant select on public.user_currency_balances to authenticated;
grant select on public.currency_access_requests to authenticated;
grant select on public.deposit_instructions to authenticated;
grant select on public.deposit_confirmations to authenticated;
grant insert (
  user_id,
  currency_code,
  instruction_id,
  amount,
  sender_name,
  sender_reference
) on public.deposit_confirmations to authenticated;

grant select on public.currencies to service_role;
grant select, insert, update on public.exchange_rates to service_role;
grant select, insert, update on public.user_currency_balances to service_role;
grant select, update on public.currency_access_requests to service_role;
grant select, insert, update on public.deposit_instructions to service_role;
grant select, update on public.deposit_confirmations to service_role;

revoke all on function public.request_currency_access(text)
  from public, anon;
grant execute on function public.request_currency_access(text)
  to authenticated;

revoke update, delete on public.currency_access_requests from authenticated;
revoke update, delete on public.deposit_confirmations from authenticated;
revoke insert, update, delete on public.currencies from authenticated;
revoke insert, update, delete on public.exchange_rates from authenticated;
revoke insert, update, delete on public.user_currency_balances from authenticated;
revoke insert, update, delete on public.deposit_instructions from authenticated;
