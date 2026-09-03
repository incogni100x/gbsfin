begin;

create extension if not exists pgtap with schema extensions;

select plan(22);

select has_type(
  'public',
  'account_deposit_method_enum',
  'account deposit method enum exists'
);
select enum_has_labels(
  'public',
  'account_deposit_method_enum',
  array['wire_ach', 'direct_deposit', 'cheque', 'stablecoin'],
  'supported account deposit methods are explicit'
);
select has_table(
  'public',
  'account_deposit_requests',
  'account deposit requests table exists'
);
select has_column(
  'public',
  'account_deposit_requests',
  'account_id',
  'account deposit requests target a user account'
);
select has_column(
  'public',
  'account_deposit_requests',
  'linked_bank_account_id',
  'Wire and ACH deposits can reference a linked bank account'
);
select has_column(
  'public',
  'account_deposit_requests',
  'cheque_file_path',
  'cheque deposits retain their private storage path'
);
select has_column(
  'public',
  'account_deposit_requests',
  'currency_code',
  'account deposit requests retain their source currency'
);
select has_column(
  'public',
  'account_deposit_requests',
  'instruction_id',
  'stablecoin deposits retain their payment instruction'
);
select has_column(
  'public',
  'account_deposit_requests',
  'sender_name',
  'stablecoin deposits retain the sender name'
);
select col_not_null(
  'public',
  'account_deposit_requests',
  'application_reference',
  'every account deposit has a support reference'
);
select has_trigger(
  'public',
  'account_deposit_requests',
  'account_deposit_requests_set_reference',
  'account deposit references are generated in the database'
);
select has_trigger(
  'public',
  'account_deposit_requests',
  'account_deposit_requests_review',
  'account deposit approvals are processed in the database'
);
select has_trigger(
  'public',
  'account_deposit_requests',
  'account_deposit_requests_notify',
  'account deposit status changes create notifications'
);
select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.account_deposit_requests'::regclass
  ),
  'account deposit requests have RLS enabled'
);
select policies_are(
  'public',
  'account_deposit_requests',
  array[
    'account_deposit_requests_owner_insert',
    'account_deposit_requests_owner_select'
  ],
  'account deposit requests expose only owner insert and select policies'
);
select has_function(
  'public',
  'submit_account_deposit_request',
  array['uuid', 'text', 'numeric', 'uuid', 'text'],
  'account deposit submission RPC exists'
);
select has_function(
  'public',
  'submit_stablecoin_deposit_request',
  array['uuid', 'text', 'uuid', 'numeric', 'text'],
  'stablecoin deposits use a dedicated account-crediting RPC'
);
select is(
  (
    select proc.prosecdef
    from pg_proc as proc
    join pg_namespace as namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.proname = 'submit_account_deposit_request'
  ),
  false,
  'account deposit submission RPC uses invoker privileges'
);
select has_column(
  'public',
  'transactions',
  'account_deposit_id',
  'approved deposits can be traced through the ledger'
);
select has_index(
  'public',
  'account_deposit_requests',
  'account_deposit_requests_user_created_at_idx',
  'owner deposit history has an index'
);
select has_index(
  'public',
  'account_deposit_requests',
  'account_deposit_requests_status_created_at_idx',
  'admin status review has an index'
);
select ok(
  exists (
    select 1 from storage.buckets where id = 'cheque-deposits' and not public
  ),
  'cheque uploads use a private storage bucket'
);

select * from finish();

rollback;
