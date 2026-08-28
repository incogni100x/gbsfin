begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'profiles_id_fkey'
  ),
  'c',
  'deleting an Auth user cascades to their profile'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'user_accounts_user_id_fkey'
  ),
  'c',
  'deleting a profile cascades to bank accounts'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'user_security_answers_user_id_fkey'
  ),
  'c',
  'deleting a profile cascades to security answers'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'user_currency_balances_user_id_fkey'
  ),
  'c',
  'deleting a profile cascades to currency balances'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'currency_access_requests_user_id_fkey'
  ),
  'c',
  'deleting a profile cascades to currency access requests'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'deposit_confirmations_user_id_fkey'
  ),
  'c',
  'deleting a profile cascades to deposit confirmations'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'currency_transfers_user_id_fkey'
  ),
  'c',
  'deleting a profile cascades to currency transfers'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'currency_transfers_destination_account_id_fkey'
  ),
  'c',
  'deleting a bank account cascades to linked transfer records'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'referral_codes_owner_user_id_fkey'
  ),
  'c',
  'deleting a profile cascades to owned referral codes'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'auth_session_verifications_user_id_fkey'
  ),
  'c',
  'deleting an Auth user cascades to session verifications'
);

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'security_answer_attempts_user_id_fkey'
  ),
  'c',
  'deleting an Auth user cascades to security-answer attempts'
);

select * from finish();

rollback;
