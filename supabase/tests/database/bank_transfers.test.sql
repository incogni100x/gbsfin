begin;
create extension if not exists pgtap with schema extensions;
select plan(32);
select has_table('public','bank_beneficiaries','bank beneficiaries exist');
select has_table('public','bank_transfers','bank transfer ledger exists');
select has_pk('public','bank_beneficiaries','beneficiaries have a primary key');
select has_pk('public','bank_transfers','bank transfers have a primary key');
select col_type_is('public','bank_transfers','destination_kind','bank_transfer_destination_enum','destination kind uses enum');
select col_type_is('public','bank_transfers','status','bank_transfer_status_enum','status uses enum');
select has_check('public','bank_transfers','bank transfers enforce checks');
select has_trigger('public','bank_transfers','bank_transfers_review','escrow review workflow exists');
select has_trigger('public','bank_transfers','bank_transfers_notify','transfer notifications exist');
select ok((select relrowsecurity from pg_class where oid='public.bank_beneficiaries'::regclass),'beneficiaries use RLS');
select ok((select relrowsecurity from pg_class where oid='public.bank_transfers'::regclass),'bank transfers use RLS');
select policies_are('public','bank_transfers',array['bank_transfers_owner_read'],'owners only read transfers');
select policies_are('public','bank_beneficiaries',array['bank_beneficiaries_owner_delete','bank_beneficiaries_owner_insert','bank_beneficiaries_owner_select','bank_beneficiaries_owner_update'],'owners manage beneficiaries');
select has_function('public','submit_bank_transfer',array['uuid','text','uuid','numeric'],'atomic transfer RPC exists');
select has_function('public','review_bank_transfer',array['uuid','text','text'],'escrow review RPC exists');
select is((select proc.prosecdef from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace where n.nspname='public' and proc.proname='submit_bank_transfer'),true,'transfer RPC uses definer privileges');
select is((select proc.proconfig from pg_proc proc join pg_namespace n on n.oid=proc.pronamespace where n.nspname='public' and proc.proname='submit_bank_transfer'),array['search_path=""'],'transfer RPC has empty search path');
select ok(has_function_privilege('authenticated','public.submit_bank_transfer(uuid,text,uuid,numeric)','EXECUTE'),'users can submit transfers');
select ok(not has_function_privilege('anon','public.submit_bank_transfer(uuid,text,uuid,numeric)','EXECUTE'),'anonymous users cannot transfer');
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
insert into public.linked_bank_accounts (id,user_id,account_type,account_name,bank_name,account_number,routing_number)
values ('31000000-0000-4000-8000-000000000013','31000000-0000-4000-8000-000000000001','personal','Bank Transfer','External Test Bank','9876543210','021000021');

select set_config('request.jwt.claims',json_build_object('role','authenticated','sub','31000000-0000-4000-8000-000000000001','session_id','31000000-0000-4000-8000-000000000002')::text,true);
set local role authenticated;
select public.set_security_answers('[{"question_id":"favorite_color","answer":"amber"},{"question_id":"favorite_food","answer":"rice"},{"question_id":"birth_city","answer":"lagos"}]'::jsonb);
select public.submit_bank_transfer('31000000-0000-4000-8000-000000000010','own_account','31000000-0000-4000-8000-000000000011',100);
select public.submit_bank_transfer('31000000-0000-4000-8000-000000000012','own_account','31000000-0000-4000-8000-000000000011',50);
select public.submit_bank_transfer('31000000-0000-4000-8000-000000000010','linked_account','31000000-0000-4000-8000-000000000013',75);
reset role;

select is((select status::text from public.bank_transfers where source_account_id='31000000-0000-4000-8000-000000000010' and destination_kind='own_account'),'completed','ordinary bank transfer completes immediately');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000010'),825::numeric,'completed and pending transfers debit their source');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000011'),100::numeric,'ordinary transfer immediately credits own destination');
select is((select status::text from public.bank_transfers where source_account_id='31000000-0000-4000-8000-000000000012'),'pending','escrow transfer waits for approval');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000012'),450::numeric,'pending escrow transfer reserves funds');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000011'),100::numeric,'pending escrow transfer does not credit destination');
select public.review_bank_transfer((select id from public.bank_transfers where source_account_id='31000000-0000-4000-8000-000000000012'),'completed','Approved by test');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000011'),150::numeric,'approved escrow transfer credits own destination once');
select is((select status::text from public.bank_transfers where linked_bank_account_id='31000000-0000-4000-8000-000000000013'),'pending','linked-bank transfer waits for approval');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000010'),825::numeric,'pending linked-bank transfer reserves funds');
select public.review_bank_transfer((select id from public.bank_transfers where linked_bank_account_id='31000000-0000-4000-8000-000000000013'),'rejected','Rejected by test');
select is((select balance from public.user_accounts where id='31000000-0000-4000-8000-000000000010'),900::numeric,'rejected linked-bank transfer refunds the source');
select * from finish();
rollback;
