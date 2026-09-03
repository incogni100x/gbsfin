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
  and (select public.is_current_session_verified())
  and (
    currency_code in ('USDC', 'USDT')
    or exists (
      select 1
      from public.user_currency_balances as balance
      where balance.user_id = (select auth.uid())
        and balance.currency_code = deposit_instructions.currency_code
    )
  )
);

comment on policy deposit_instructions_approved_currency_read
on public.deposit_instructions is
  'Verified users can read active stablecoin instructions; fiat instructions require an enabled currency balance.';

commit;
