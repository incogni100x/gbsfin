begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

revoke all on function public.make_loan_payment(uuid, uuid, numeric, uuid)
from public, anon, authenticated, service_role;
drop function public.make_loan_payment(uuid, uuid, numeric, uuid);

drop function public.process_due_loan_payments(date);
alter function public.process_due_loan_payments_before_manual_ledger(date)
  rename to process_due_loan_payments;

revoke all on function public.process_due_loan_payments(date)
from public, anon, authenticated;
grant execute on function public.process_due_loan_payments(date)
to service_role;

-- Financial history is deliberately preserved during rollback. The new RPC is
-- removed, and the ledger remains read-only until the feature is restored.
revoke all on public.loan_payments from public, anon, authenticated;
grant select on public.loan_payments to service_role;

commit;
