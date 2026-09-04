begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table private.stablecoin_deposit_migration_archive
  drop constraint if exists stablecoin_deposit_migration_archive_user_id_fkey;

commit;
