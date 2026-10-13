begin;
create extension if not exists pgtap with schema extensions;
select plan(59);
select has_table('public','bank_beneficiaries','bank beneficiaries exist');
select has_table('public','bank_transfers','bank transfer ledger exists');
select has_pk('public','bank_beneficiaries','beneficiaries have a primary key');
select has_pk('public','bank_transfers','bank transfers have a primary key');
select col_type_is('public','bank_transfers','destination_kind','bank_transfer_destination_enum','destination kind uses enum');
select col_type_is('public','bank_transfers','status','bank_transfer_status_enum','status uses enum');
select col_type_is('public','bank_transfers','transfer_type','bank_transfer_type_enum','transfer type uses enum');
select col_type_is('public','linked_bank_accounts','transfer_scope','linked_bank_account_scope_enum','linked account scope uses enum');
select has_column('public','linked_bank_accounts','address','linked accounts store recipient addresses');
select has_column('public','linked_bank_accounts','swift_code','international linked accounts store SWIFT/BIC codes');
select has_column('public','bank_transfers','recipient_swift_code','bank transfers snapshot recipient SWIFT/BIC codes');
select has_check('public','bank_transfers','bank transfers enforce checks');
select has_trigger('public','bank_transfers','bank_transfers_review','escrow review workflow exists');
select has_trigger('public','bank_transfers','bank_transfers_notify','transfer notifications exist');
select ok((select relrowsecurity from pg_class where oid='public.bank_beneficiaries'::regclass),'beneficiaries use RLS');
select ok((select relrowsecurity from pg_class where oid='public.bank_transfers'::regclass),'bank transfers use RLS');
select policies_are('public','bank_transfers',array['bank_transfers_owner_read'],'owners only read transfers');
select policies_are('public','bank_beneficiaries',array['bank_beneficiaries_owner_delete','bank_beneficiaries_owner_insert','bank_beneficiaries_owner_select','bank_beneficiaries_owner_update'],'owners manage beneficiaries');
select has_function('public','submit_bank_transfer',array['uuid','text','uuid','numeric'],'atomic transfer RPC exists');
select has_function('public','create_linked_account_and_submit_bank_transfer',array['uuid','text','numeric','text','text','text','text','text','text','text'],'atomic save-and-transfer RPC exists');
select has_function('public','review_bank_transfer',array['uuid','text','text'],'escrow review RPC exists');
select is((select proc.prosecdef from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace where n.nspname='public' and proc.proname='submit_bank_transfer'),true,'transfer RPC uses definer privileges');
select is((select proc.proconfig from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace where n.nspname='public' and proc.proname='submit_bank_transfer'),array['search_path=""'],'transfer RPC has empty search path');
select ok(has_function_privilege('authenticated','public.submit_bank_transfer(uuid,text,uuid,numeric)','EXECUTE'),'users can submit transfers');
select ok(has_function_privilege('authenticated','public.create_linked_account_and_submit_bank_transfer(uuid,text,numeric,text,text,text,text,text,text,text)','EXECUTE'),'users can atomically save a recipient and submit a transfer');
select ok(not has_function_privilege('anon','public.submit_bank_transfer(uuid,text,uuid,numeric)','EXECUTE'),'anonymous users cannot transfer');
select ok(not has_function_privilege('anon','public.create_linked_account_and_submit_bank_transfer(uuid,text,numeric,text,text,text,text,text,text,text)','EXECUTE'),'anonymous users cannot save a recipient and transfer');
select ok(not has_function_privilege('authenticated','public.review_bank_transfer(uuid,text,text)','EXECUTE'),'users cannot review escrow transfers');
select ok(not has_table_privilege('authenticated','public.bank_transfers','INSERT'),'users cannot insert transfers directly');
select ok(not has_table_privilege('authenticated','public.bank_transfers','UPDATE'),'users cannot approve escrow transfers');

insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data,is_sso_user,is_anonymous)
values ('31000000-0000-4000-8000-000000000001','bank-transfer-test@example.invalid','{"provider":"email","providers":["email"]}'::jsonb,'{"first_name":"Bank","last_name":"Transfer"}'::jsonb,false,false);

insert into public.user_accounts (id,user_id,account_type_id,account_number,balance,currency_code)
select '31000000-0000-4000-8000-000000000010','31000000-0000-4000-8000-000000000001',id,'TEST-BANK-SOURCE',1000,'USD' from public.account_types where name='Savings';
insert into public.user_accounts (id,user_id,account_type_id,account_number,balance,currency_code)
select '31000000-0000-4000-8000-000000000011','31000000-0000-4000-8000-000000000001',id,'TEST-BANK-DEST',0,'USD' from public.account_types where name='Checking';
insert into public.user_accounts (id,user_id,account_type_id,account_number,balance,currency_code)
select '31000000-0000-4000-8000-000000000012','31000000-0000-4000-8000-000000000001',id,'TEST-ESCROW-SOURCE',500,'USD' from public.account_types where name='Escrow';
insert into public.linked_bank_accounts (id,user_id,account_type,account_name,bank_name,account_number,routing_number,swift_code,address,transfer_scope)
values
  ('31000000-0000-4000-8000-000000000013','31000000-0000-4000-8000-000000000001','personal','Bank Transfer','External Test Bank','9876543210','021000021',null,'10 Domestic Street','domestic'),
  ('31000000-0000-4000-8000-000000000014','31000000-0000-4000-8000-000000000001','business','International Recipient','International Test Bank','9876543211',null,'INTL-CODE','20 International Street','international');
insert into public.user_accounts (id,user_id,account_type_id,account_number,balance,currency_code)
select '31000000-0000-4000-8000-000000000015','31000000-0000-4000-8000-000000000001',id,'TEST-EUR-SOURCE',100,'EUR' from public.account_types where name='Savings';

select set_config('request.jwt.claims',json_build_object('role','authenticated','sub','31000000-0000-4000-8000-000000000001','session_id','31000000-0000-4000-8000-000000000002')::text,true);
set local role authenticated;
select public.set_security_answers('[{"question_id":"favorite_color","answer":"amber"},{"question_id":"favorite_food","answer":"rice"},{"question_id":"birth_city","answer":"lagos"}]'::jsonb);
select public.submit_bank_transfer('31000000-0000-4000-8000-000000000010','own_account','31000000-0000-4000-8000-000000000011',100);
select public.submit_bank_transfer('31000000-0000-4000-8000-000000000012','own_account','31000000-0000-4000-8000-000000000011',50);
select public.submit_bank_transfer('31000000-0000-4000-8000-000000000010','linked_account','31000000-0000-4000-8000-000000000013',75);
reset role;

select is((select status::text from public.bank_transfers where source_account_id='31000000-0000-4000-8000-000000000010' and destination_kind='own_account'),'completed','ordinary bank transfer completes immediately');
select is((select transfer_type::text from public.bank_transfers where source_account_id='31000000-0000-4000-8000-000000000010' and destination_kind='own_account'),'between_accounts','own-account transfer is classified correctly');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000010'),825::numeric,'completed and pending transfers debit their source');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000011'),100::numeric,'ordinary transfer immediately credits own destination');
select is((select status::text from public.bank_transfers where source_account_id='31000000-0000-4000-8000-000000000012'),'pending','escrow transfer waits for approval');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000012'),450::numeric,'pending escrow transfer reserves funds');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000011'),100::numeric,'pending escrow transfer does not credit destination');
select public.review_bank_transfer((select id from public.bank_transfers where source_account_id='31000000-0000-4000-8000-000000000012'),'completed','Approved by test');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000011'),150::numeric,'approved escrow transfer credits own destination once');
select is((select status::text from public.bank_transfers where linked_bank_account_id='31000000-0000-4000-8000-000000000013'),'pending','linked-bank transfer waits for approval');
select is((select transfer_type::text from public.bank_transfers where linked_bank_account_id='31000000-0000-4000-8000-000000000013'),'domestic','legacy linked account transfer is classified as domestic');
select is((select recipient_routing_number from public.bank_transfers where linked_bank_account_id='31000000-0000-4000-8000-000000000013'),'021000021','domestic transfer snapshots the routing number');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000010'),825::numeric,'pending linked-bank transfer reserves funds');
select public.review_bank_transfer((select id from public.bank_transfers where linked_bank_account_id='31000000-0000-4000-8000-000000000013'),'rejected','Rejected by test');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000010'),900::numeric,'rejected linked-bank transfer refunds the source');

select public.submit_bank_transfer('31000000-0000-4000-8000-000000000010','linked_account','31000000-0000-4000-8000-000000000014',25);
select is((select transfer_type::text from public.bank_transfers where linked_bank_account_id='31000000-0000-4000-8000-000000000014'),'international','USD external transfer is classified as international');
select is((select status::text from public.bank_transfers where linked_bank_account_id='31000000-0000-4000-8000-000000000014'),'pending','international transfer waits for approval');
select is((select recipient_address from public.bank_transfers where linked_bank_account_id='31000000-0000-4000-8000-000000000014'),'20 International Street','international transfer snapshots the recipient address');
select is((select recipient_swift_code from public.bank_transfers where linked_bank_account_id='31000000-0000-4000-8000-000000000014'),'INTL-CODE','international transfer accepts and snapshots a non-empty SWIFT/BIC value without strict format validation');

select public.create_linked_account_and_submit_bank_transfer(
  '31000000-0000-4000-8000-000000000010',
  'domestic',
  10,
  'personal',
  'Atomic Recipient',
  'Atomic Test Bank',
  '9876543212',
  '021000023',
  null,
  '30 Atomic Street'
);
select is((select count(*) from public.linked_bank_accounts where account_number='9876543212'),1::bigint,'new recipient is saved for reuse');
select is((select transfer_type::text from public.bank_transfers where recipient_account_number='9876543212'),'domestic','new recipient transfer is classified as domestic');
select is((select status::text from public.bank_transfers where recipient_account_number='9876543212'),'pending','new recipient transfer waits for approval');

select throws_ok(
  $$select public.submit_bank_transfer('31000000-0000-4000-8000-000000000015','linked_account','31000000-0000-4000-8000-000000000014',5)$$,
  'P0001',
  'International transfers are available only from USD bank accounts',
  'non-USD bank accounts cannot submit international transfers'
);
select throws_ok(
  $$select public.create_linked_account_and_submit_bank_transfer('31000000-0000-4000-8000-000000000010','domestic',1000000,'personal','Rollback Recipient','Rollback Test Bank','9876543213','021000024',null,'40 Rollback Street')$$,
  'P0001',
  'Insufficient bank account balance',
  'failed new-recipient transfer reports the balance error'
);
select is((select count(*) from public.linked_bank_accounts where account_number='9876543213'),0::bigint,'failed transfer rolls back the newly saved recipient');

select public.create_linked_account_and_submit_bank_transfer(
  '31000000-0000-4000-8000-000000000010',
  'international',
  5,
  'business',
  'Atomic Recipient Updated',
  'Atomic Test Bank',
  '9876543212',
  null,
  'ATOMGB2LXXX',
  '31 Updated Atomic Street'
);
select is((select count(*) from public.linked_bank_accounts where account_number='9876543212'),1::bigint,'same bank and account number reuse the saved account');
select is((select transfer_scope::text from public.linked_bank_accounts where account_number='9876543212'),'international','reused recipient details are refreshed');
select is((select count(*) from public.bank_transfers where recipient_account_number='9876543212' and transfer_type='international'),1::bigint,'reused recipient creates the requested transfer');

select public.create_linked_account_and_submit_bank_transfer(
  '31000000-0000-4000-8000-000000000010',
  'domestic',
  5,
  'personal',
  'Different Bank Recipient',
  'Different Test Bank',
  '9876543212',
  '021000026',
  null,
  '32 Different Bank Street'
);
select is((select count(*) from public.linked_bank_accounts where account_number='9876543212'),2::bigint,'the same account number is allowed at a different bank');
select is((select count(*) from public.linked_bank_accounts where account_number='9876543212' and bank_name='Different Test Bank'),1::bigint,'the different-bank recipient is stored separately');
select is((select count(*) from public.bank_transfers where recipient_account_number='9876543212' and recipient_bank_name='Different Test Bank'),1::bigint,'the transfer uses the distinct bank recipient');
select * from finish();
rollback;
