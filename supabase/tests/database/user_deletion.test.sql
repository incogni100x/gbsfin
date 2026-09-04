begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

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
    where conname = 'currency_deposits_user_id_fkey'
  ),
  'c',
  'deleting a profile cascades to currency deposits'
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
    where conname = 'currency_conversions_destination_account_id_fkey'
  ),
  'c',
  'deleting a bank account cascades to linked transfer records'
);

select is(
  (select confdeltype::text from pg_constraint where conname = 'bank_beneficiaries_user_id_fkey'),
  'c',
  'deleting a profile cascades to bank beneficiaries'
);

select is(
  (select confdeltype::text from pg_constraint where conname = 'bank_transfers_user_id_fkey'),
  'c',
  'deleting a profile cascades to bank transfers'
);

select is(
  (select confdeltype::text from pg_constraint where conname = 'bank_transfers_source_account_id_fkey'),
  'c',
  'deleting a source account cascades to bank transfers'
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

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conname = 'stablecoin_deposit_migration_archive_user_id_fkey'
  ),
  'c',
  'deleting a profile cascades to the stablecoin migration archive'
);

select is(
  (
    with user_columns as (
      select table_info.oid as table_oid, attribute.attnum
      from pg_class as table_info
      join pg_namespace as namespace on namespace.oid = table_info.relnamespace
      join pg_attribute as attribute on attribute.attrelid = table_info.oid
      where table_info.relkind in ('r', 'p')
        and namespace.nspname in ('public', 'private')
        and attribute.attnum > 0
        and not attribute.attisdropped
        and attribute.attname in ('user_id', 'owner_user_id')
    ),
    cascade_columns as (
      select constraint_info.conrelid as table_oid, key_column.attnum
      from pg_constraint as constraint_info
      cross join lateral unnest(constraint_info.conkey) as key_column(attnum)
      where constraint_info.contype = 'f'
        and constraint_info.confdeltype = 'c'
    )
    select count(*)
    from user_columns
    left join cascade_columns using (table_oid, attnum)
    where cascade_columns.table_oid is null
  ),
  0::bigint,
  'every public and private user-owned table has an ON DELETE CASCADE path'
);

select * from finish();

rollback;
