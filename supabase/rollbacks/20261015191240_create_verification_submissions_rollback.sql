-- Reverses 20261015191240 only while the feature contains no submitted data.
-- Storage objects must be removed through the Storage API before this rollback.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if exists (select 1 from public.verification_submissions) then
    raise exception
      'Rollback stopped: verification submissions exist and require export or deletion';
  end if;

  if exists (
    select 1
    from storage.objects
    where bucket_id = 'verification-submissions'
  ) then
    raise exception
      'Rollback stopped: verification files must be removed through the Storage API first';
  end if;
end;
$$;

delete from storage.buckets
where id = 'verification-submissions';

drop table public.verification_submissions;

commit;
