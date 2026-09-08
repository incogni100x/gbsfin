-- Rollback-only acceptance test for the production account supplied by the owner.
-- This intentionally exercises the live RLS/RPC/trigger paths, then restores all
-- rows and balances at the end of the transaction.
begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temp table qa_context (
  user_id uuid not null,
  session_id uuid not null,
  checking_id uuid not null,
  savings_id uuid not null,
  escrow_id uuid not null,
  linked_id uuid,
  disposable_linked_id uuid,
  direct_deposit_id uuid,
  wire_deposit_id uuid,
  cheque_deposit_id uuid,
  usdc_deposit_id uuid,
  usdt_deposit_id uuid,
  currency_deposit_id uuid,
  immediate_transfer_id uuid,
  reverse_transfer_id uuid,
  escrow_reject_id uuid,
  escrow_approve_id uuid,
  linked_reject_id uuid,
  linked_approve_id uuid,
  checking_conversion_id uuid,
  reverse_conversion_id uuid,
  currency_conversion_id uuid,
  reverse_currency_conversion_id uuid,
  currency_transfer_reject_id uuid,
  currency_transfer_approve_id uuid,
  fixed_deposit_id uuid,
  loan_id uuid,
  rejected_loan_id uuid
);

insert into qa_context (user_id, session_id, checking_id, savings_id, escrow_id)
values (
  '7bd344c0-1adb-41fb-b248-76be23e3507f',
  gen_random_uuid(),
  '34eee342-c4e6-4515-ad71-2205e5235d1e',
  'ec2f57fc-11c5-4a78-b945-9c76c4006a9f',
  'ee0eba74-2515-4ba4-ad27-046378d3fd38'
);

grant select, update on qa_context to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from public.profiles p join qa_context q on q.user_id = p.id
  ) then raise exception 'QA user profile does not exist'; end if;
  if (select count(*) from public.user_accounts a join qa_context q on q.user_id = a.user_id) < 3
  then raise exception 'QA user does not have the required accounts'; end if;
end;
$$;

insert into private.auth_session_verifications (session_id, user_id)
select session_id, user_id from qa_context;

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', user_id,
    'role', 'authenticated',
    'session_id', session_id
  )::text,
  true
)
from qa_context;
set local role authenticated;

-- Linked account: create, edit, and later delete through owner RLS.
with inserted as (
  insert into public.linked_bank_accounts (
    user_id, account_type, account_name, bank_name, account_number, routing_number
  )
  select user_id, 'personal', 'QA Personal Account', 'QA Acceptance Bank',
         'QA' || replace(gen_random_uuid()::text, '-', ''), '021000021'
  from qa_context
  returning id
)
update qa_context set linked_id = (select id from inserted);

update public.linked_bank_accounts
set account_name = 'QA Personal Account Updated'
where id = (select linked_id from qa_context);

with inserted as (
  insert into public.linked_bank_accounts (
    user_id, account_type, account_name, bank_name, account_number, routing_number
  )
  select user_id, 'business', 'QA Disposable Account', 'QA Acceptance Bank',
         'QA' || replace(gen_random_uuid()::text, '-', ''), '021000021'
  from qa_context
  returning id
)
update qa_context set disposable_linked_id = (select id from inserted);

delete from public.linked_bank_accounts
where id = (select disposable_linked_id from qa_context);

-- Bank-account deposits: approved, rejected, check, and stablecoin paths.
update qa_context set direct_deposit_id = (
  select (public.submit_account_deposit_request(checking_id, 'direct_deposit', 11, null, null)).id
  from qa_context
);
update qa_context set wire_deposit_id = (
  select (public.submit_account_deposit_request(checking_id, 'wire_ach', 12, linked_id, null)).id
  from qa_context
);
update qa_context set cheque_deposit_id = (
  select (public.submit_account_deposit_request(
    checking_id, 'cheque', 13, null, user_id::text || '/qa-acceptance-check.png'
  )).id from qa_context
);
update qa_context set usdc_deposit_id = (
  select (public.submit_stablecoin_deposit_request(
    q.checking_id, 'USDC', i.id, 15, 'QA Sender'
  )).id
  from qa_context q
  join public.deposit_instructions i on i.currency_code = 'USDC' and i.is_active
  limit 1
);
update qa_context set usdt_deposit_id = (
  select (public.submit_stablecoin_deposit_request(
    q.checking_id, 'USDT', i.id, 16, 'QA Sender'
  )).id
  from qa_context q
  join public.deposit_instructions i on i.currency_code = 'USDT' and i.is_active
  limit 1
);

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.account_deposit_requests set status = 'approved'
where id in (
  select direct_deposit_id from qa_context union all
  select cheque_deposit_id from qa_context union all
  select usdc_deposit_id from qa_context
);
update public.account_deposit_requests set status = 'rejected', review_note = 'QA rejection path'
where id in (
  select wire_deposit_id from qa_context union all
  select usdt_deposit_id from qa_context
);

-- Currency access: approve GBP and reject EUR.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_id, 'role', 'authenticated', 'session_id', session_id)::text,
  true
) from qa_context;
set local role authenticated;
select public.request_currency_access('GBP');
select public.request_currency_access('EUR');

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.currency_access_requests set status = 'approved'
where user_id = (select user_id from qa_context) and currency_code = 'GBP';
update public.currency_access_requests set status = 'rejected', review_note = 'QA rejection path'
where user_id = (select user_id from qa_context) and currency_code = 'EUR';

-- Fiat-currency deposit into the newly enabled GBP balance.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_id, 'role', 'authenticated', 'session_id', session_id)::text,
  true
) from qa_context;
set local role authenticated;
with inserted as (
  insert into public.currency_deposits (
    user_id, currency_code, instruction_id, amount, sender_name
  )
  select q.user_id, 'GBP', i.id, 10, 'QA Sender'
  from qa_context q
  join public.deposit_instructions i on i.currency_code = 'GBP' and i.is_active
  limit 1
  returning id
)
update qa_context set currency_deposit_id = (select id from inserted);

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.currency_deposits set status = 'approved'
where id = (select currency_deposit_id from qa_context);

-- Bank transfers: immediate own-account, escrow approval/rejection, and
-- linked-account approval/rejection.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_id, 'role', 'authenticated', 'session_id', session_id)::text,
  true
) from qa_context;
set local role authenticated;
update qa_context set immediate_transfer_id = (
  select (public.submit_bank_transfer(checking_id, 'own_account', savings_id, 2)).id
  from qa_context
);
update qa_context set reverse_transfer_id = (
  select (public.submit_bank_transfer(savings_id, 'own_account', checking_id, 2)).id
  from qa_context
);
update qa_context set escrow_reject_id = (
  select (public.submit_bank_transfer(checking_id, 'own_account', escrow_id, 3)).id
  from qa_context
);
update qa_context set escrow_approve_id = (
  select (public.submit_bank_transfer(checking_id, 'own_account', escrow_id, 4)).id
  from qa_context
);
update qa_context set linked_reject_id = (
  select (public.submit_bank_transfer(checking_id, 'linked_account', linked_id, 5)).id
  from qa_context
);
update qa_context set linked_approve_id = (
  select (public.submit_bank_transfer(checking_id, 'linked_account', linked_id, 6)).id
  from qa_context
);

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.review_bank_transfer((select escrow_reject_id from qa_context), 'rejected', 'QA rejection path');
select public.review_bank_transfer((select escrow_approve_id from qa_context), 'completed', 'QA approval path');
select public.review_bank_transfer((select linked_reject_id from qa_context), 'rejected', 'QA rejection path');
select public.review_bank_transfer((select linked_approve_id from qa_context), 'completed', 'QA approval path');

-- Checking <-> currency and currency <-> currency conversions.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_id, 'role', 'authenticated', 'session_id', session_id)::text,
  true
) from qa_context;
set local role authenticated;
update qa_context set checking_conversion_id = (
  select (public.convert_checking_account_balance(checking_id, 5, 'AUD')).id
  from qa_context
);
update qa_context set reverse_conversion_id = (
  select (public.convert_currency_balance(
    'AUD', c.destination_amount, 'bank_account', 'USD', q.checking_id
  )).id
  from qa_context q
  join public.currency_conversions c on c.id = q.checking_conversion_id
);
update qa_context set currency_conversion_id = (
  select (public.convert_currency_balance('AUD', 1, 'currency_balance', 'AED', null)).id
);
update qa_context set reverse_currency_conversion_id = (
  select (public.convert_currency_balance(
    'AED', c.destination_amount, 'currency_balance', 'AUD', null
  )).id
  from qa_context q
  join public.currency_conversions c on c.id = q.currency_conversion_id
);

-- Native currency transfer: rejection refunds; approval retains reservation.
update qa_context set currency_transfer_reject_id = (
  select (public.request_currency_transfer(
    'AUD', 1.25, 'QA Recipient', 'QA Australia Bank', null,
    '1 QA Street, Sydney NSW 2000', '12345678', null, null,
    null, null, null, '062000', null, null, null
  )).id
);
update qa_context set currency_transfer_approve_id = (
  select (public.request_currency_transfer(
    'AUD', 1.50, 'QA Recipient', 'QA Australia Bank', null,
    '1 QA Street, Sydney NSW 2000', '12345678', null, null,
    null, null, null, '062000', null, null, null
  )).id
);

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
select public.review_currency_transfer((select currency_transfer_reject_id from qa_context), 'rejected', 'QA rejection path');
select public.review_currency_transfer((select currency_transfer_approve_id from qa_context), 'approved', 'QA approval path');

-- Fixed deposit: automatic opening, closure rejection, re-request, approval,
-- and payout. This test creates a new deposit and does not touch existing rows.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_id, 'role', 'authenticated', 'session_id', session_id)::text,
  true
) from qa_context;
set local role authenticated;
update qa_context set fixed_deposit_id = (
  select (public.open_fixed_deposit(checking_id, 1::smallint, 20::numeric)).id from qa_context
);
select public.request_fixed_deposit_closure((select fixed_deposit_id from qa_context));

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.fixed_deposits set status = 'rejected'
where id = (select fixed_deposit_id from qa_context);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_id, 'role', 'authenticated', 'session_id', session_id)::text,
  true
) from qa_context;
set local role authenticated;
select public.request_fixed_deposit_closure((select fixed_deposit_id from qa_context));

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.fixed_deposits set status = 'completed'
where id = (select fixed_deposit_id from qa_context);

-- Loan: approval/disbursement, partial payment, overdue-first payment,
-- full payoff, plus a separate rejection path.
reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_id, 'role', 'authenticated', 'session_id', session_id)::text,
  true
) from qa_context;
set local role authenticated;
update qa_context set loan_id = (
  select (public.request_loan(
    checking_id, 1::smallint, 1::smallint, 50::numeric, 'Emergency expenses'
  )).id
  from qa_context
);
update qa_context set rejected_loan_id = (
  select (public.request_loan(
    savings_id, 1::smallint, 1::smallint, 25::numeric, 'Education'
  )).id
  from qa_context
);

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.loans set status = 'approved' where id = (select loan_id from qa_context);
update public.loans set status = 'rejected' where id = (select rejected_loan_id from qa_context);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_id, 'role', 'authenticated', 'session_id', session_id)::text,
  true
) from qa_context;
set local role authenticated;
select public.make_loan_payment(
  (select loan_id from qa_context), (select checking_id from qa_context), 10, gen_random_uuid()
);

reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
set local role service_role;
update public.loans
set overdue_amount = 3, overdue_count = 1, is_overdue = true
where id = (select loan_id from qa_context);

reset role;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', user_id, 'role', 'authenticated', 'session_id', session_id)::text,
  true
) from qa_context;
set local role authenticated;
select public.make_loan_payment(
  (select loan_id from qa_context), (select checking_id from qa_context), 3, gen_random_uuid()
);
select public.make_loan_payment(
  (select loan_id from qa_context),
  (select checking_id from qa_context),
  (select remaining_balance from public.loans where id = (select loan_id from qa_context)),
  gen_random_uuid()
);

-- Notification read action. The referenced linked-account row is left in place
-- until transaction rollback because reviewed deposits retain its audit link.
update public.notifications set is_read = true
where id = (
  select n.id from public.notifications n
  join qa_context q on q.user_id = n.user_id
  where n.created_at >= transaction_timestamp()
  order by n.created_at, n.id
  limit 1
);
reset role;

-- Final assertions. Any failure aborts the transaction before rollback.
do $$
declare
  q qa_context;
begin
  select * into q from qa_context;

  if (select status from public.account_deposit_requests where id = q.direct_deposit_id) <> 'approved'
    or (select status from public.account_deposit_requests where id = q.wire_deposit_id) <> 'rejected'
    or (select status from public.account_deposit_requests where id = q.cheque_deposit_id) <> 'approved'
    or (select status from public.account_deposit_requests where id = q.usdc_deposit_id) <> 'approved'
    or (select status from public.account_deposit_requests where id = q.usdt_deposit_id) <> 'rejected'
  then raise exception 'Deposit workflow assertion failed'; end if;

  if (select status from public.currency_access_requests where user_id = q.user_id and currency_code = 'GBP') <> 'approved'
    or not exists (select 1 from public.user_currency_balances where user_id = q.user_id and currency_code = 'GBP')
    or (select status from public.currency_deposits where id = q.currency_deposit_id) <> 'approved'
  then raise exception 'Currency access/deposit assertion failed'; end if;

  if (select status from public.bank_transfers where id = q.immediate_transfer_id) <> 'completed'
    or (select status from public.bank_transfers where id = q.escrow_reject_id) <> 'rejected'
    or (select status from public.bank_transfers where id = q.escrow_approve_id) <> 'completed'
    or (select status from public.bank_transfers where id = q.linked_reject_id) <> 'rejected'
    or (select status from public.bank_transfers where id = q.linked_approve_id) <> 'completed'
  then raise exception 'Bank transfer assertion failed'; end if;

  if not exists (select 1 from public.currency_conversions where id = q.checking_conversion_id)
    or not exists (select 1 from public.currency_conversions where id = q.reverse_conversion_id)
    or not exists (select 1 from public.currency_conversions where id = q.currency_conversion_id)
    or not exists (select 1 from public.currency_conversions where id = q.reverse_currency_conversion_id)
  then raise exception 'Currency conversion assertion failed'; end if;

  if (select status from public.currency_transfers where id = q.currency_transfer_reject_id) <> 'rejected'
    or (select status from public.currency_transfers where id = q.currency_transfer_approve_id) <> 'approved'
  then raise exception 'Currency transfer assertion failed'; end if;

  if (select status from public.fixed_deposits where id = q.fixed_deposit_id) <> 'closed'
    or not exists (select 1 from public.transactions where fixed_deposit_id = q.fixed_deposit_id and type = 'fixed_deposit_payout')
  then raise exception 'Fixed-deposit assertion failed'; end if;

  if (select status from public.loans where id = q.loan_id) <> 'completed'
    or (select remaining_balance from public.loans where id = q.loan_id) <> 0
    or (select overdue_amount from public.loans where id = q.loan_id) <> 0
    or (select status from public.loans where id = q.rejected_loan_id) <> 'rejected'
    or (select count(*) from public.loan_payments where loan_id = q.loan_id) <> 3
  then raise exception 'Loan workflow assertion failed'; end if;

  if exists (select 1 from public.linked_bank_accounts where id = q.disposable_linked_id)
    or (select count(*) from public.notifications where user_id = q.user_id and created_at >= transaction_timestamp()) < 10
  then raise exception 'Linked-account or notification assertion failed'; end if;
end;
$$;

rollback;
