begin;

create extension if not exists pgtap with schema extensions;

select plan(21);

select has_table(
  'public',
  'currency_transfers',
  'currency transfer ledger exists'
);

select has_pk(
  'public',
  'currency_transfers',
  'currency transfer ledger has a primary key'
);

select has_column(
  'public',
  'currency_transfers',
  'destination_account_id',
  'currency transfers can target a bank account'
);

select has_column(
  'public',
  'currency_transfers',
  'source_account_id',
  'currency transfers can originate from a bank account'
);

select has_column(
  'public',
  'currency_transfers',
  'exchange_rate',
  'currency transfers preserve their applied exchange rate'
);

select has_check(
  'public',
  'currency_transfers',
  'currency transfer ledger has database checks'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.currency_transfers'::regclass
  ),
  'currency transfer ledger has RLS enabled'
);

select policies_are(
  'public',
  'currency_transfers',
  array['currency_transfers_owner_read'],
  'currency transfer ledger only exposes the owner read policy'
);

select has_function(
  'public',
  'transfer_currency_balance',
  array['text', 'numeric', 'text', 'text', 'uuid'],
  'atomic currency transfer RPC exists'
);

select has_function(
  'public',
  'transfer_bank_account_to_usd_balance',
  array['uuid', 'numeric'],
  'atomic bank account to USD balance RPC exists'
);

select is(
  (
    select proc.prosecdef
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'transfer_bank_account_to_usd_balance'
  ),
  true,
  'bank account transfer RPC runs with definer privileges'
);

select is(
  (
    select proc.proconfig
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'transfer_bank_account_to_usd_balance'
  ),
  array['search_path=""'],
  'bank account transfer RPC uses an empty search path'
);

select is(
  (
    select proc.prosecdef
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'transfer_currency_balance'
  ),
  true,
  'currency transfer RPC runs with definer privileges'
);

select is(
  (
    select proc.proconfig
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'transfer_currency_balance'
  ),
  array['search_path=""'],
  'currency transfer RPC uses an empty search path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.transfer_currency_balance(text,numeric,text,text,uuid)',
    'EXECUTE'
  ),
  'authenticated users can execute currency transfers'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.transfer_bank_account_to_usd_balance(uuid,numeric)',
    'EXECUTE'
  ),
  'authenticated users can fund their USD balance from a bank account'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.transfer_bank_account_to_usd_balance(uuid,numeric)',
    'EXECUTE'
  ),
  'anonymous users cannot fund a USD balance from a bank account'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.transfer_currency_balance(text,numeric,text,text,uuid)',
    'EXECUTE'
  ),
  'anonymous users cannot execute currency transfers'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.currency_transfers',
    'INSERT'
  ),
  'authenticated users cannot insert transfer records directly'
);

select is(
  (
    select constraint_info.confdeltype::text
    from pg_constraint as constraint_info
    where constraint_info.conrelid = 'public.currency_transfers'::regclass
      and constraint_info.conname =
        'currency_transfers_destination_account_id_fkey'
  ),
  'c',
  'deleting a bank account cascades to its linked transfer records'
);

select is(
  (
    select constraint_info.confdeltype::text
    from pg_constraint as constraint_info
    where constraint_info.conrelid = 'public.currency_transfers'::regclass
      and constraint_info.conname =
        'currency_transfers_source_account_id_fkey'
  ),
  'c',
  'deleting a source account cascades to its linked transfer records'
);

select * from finish();

rollback;
