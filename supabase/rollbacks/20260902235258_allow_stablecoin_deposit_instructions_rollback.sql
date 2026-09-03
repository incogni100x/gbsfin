begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop policy deposit_instructions_approved_currency_read
  on public.deposit_instructions;

create policy deposit_instructions_approved_currency_read
on public.deposit_instructions
for select
to authenticated
using (
  is_active
  and exists (
    select 1
    from public.user_currency_balances as balance
    where balance.user_id = (select auth.uid())
      and balance.currency_code = deposit_instructions.currency_code
  )
  and (select public.is_current_session_verified())
);

commit;
