# Scheduled financial jobs

The two financial Edge Functions are ready for Supabase Cron:

- `process-fixed-deposits`: records daily fixed-deposit profit and matures deposits.
- `process-loan-payments`: processes loan instalments due through the supplied date.

Both functions require a dedicated `CRON_SECRET` in their runtime environment.
They never accept the service-role key from an HTTP caller.

## One-time setup

1. Generate a strong random value and add it as the `CRON_SECRET` Edge Function secret.
2. In Vault, create `financial_jobs_cron_secret` with that same value.
3. In Vault, create `project_url` with the project URL, without a trailing slash.
4. Deploy both functions, then run `schedule-financial-jobs.sql` in the SQL editor.

For the linked Global Stripe Fin project, steps 1–3 and the function deployments
were completed on 2026-09-08. Run the scheduling SQL only when the daily jobs
should become active.

The schedules use UTC. Fixed deposits run at 00:05 and loan payments at 00:15.
Supabase records executions in `cron.job_run_details`; HTTP results are available
through `net._http_response` for the configured retention period.
