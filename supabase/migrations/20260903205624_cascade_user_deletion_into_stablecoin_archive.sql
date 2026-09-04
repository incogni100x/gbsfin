begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Remove historical rows whose owning Auth user was already deleted before
-- this archive participated in the profile cascade.
delete from private.stablecoin_deposit_migration_archive as archive
where not exists (
  select 1
  from public.profiles as profile
  where profile.id = archive.user_id
);

alter table private.stablecoin_deposit_migration_archive
  add constraint stablecoin_deposit_migration_archive_user_id_fkey
  foreign key (user_id)
  references public.profiles(id)
  on delete cascade
  not valid;

alter table private.stablecoin_deposit_migration_archive
  validate constraint stablecoin_deposit_migration_archive_user_id_fkey;

commit;
