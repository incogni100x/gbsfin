begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $validation$
begin
  if not exists (
    select 1 from vault.secrets where name = 'project_url'
  ) or not exists (
    select 1 from vault.secrets where name = 'financial_jobs_cron_secret'
  ) then
    raise exception 'Create project_url and financial_jobs_cron_secret in Vault before scheduling financial jobs';
  end if;
end;
$validation$;

select cron.unschedule(jobid)
from cron.job
where jobname in (
  'process-daily-fixed-deposits',
  'process-due-loan-payments'
);

select cron.schedule(
  'process-daily-fixed-deposits',
  '5 0 * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
    ) || '/functions/v1/process-fixed-deposits',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'financial_jobs_cron_secret'
      )
    ),
    body := jsonb_build_object('requested_at', now()),
    timeout_milliseconds := 60000
  );
  $$
);

select cron.schedule(
  'process-due-loan-payments',
  '15 0 * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'project_url'
    ) || '/functions/v1/process-loan-payments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'financial_jobs_cron_secret'
      )
    ),
    body := jsonb_build_object('requested_at', now()),
    timeout_milliseconds := 60000
  );
  $$
);

commit;
