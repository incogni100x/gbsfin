begin;

set local lock_timeout = '5s';
set local statement_timeout = '90s';

drop function public.convert_checking_account_balance(uuid, numeric, text);

drop function public.convert_currency_balance(text, numeric, text, text, uuid);
alter function public.convert_currency_balance_before_checking_requirement(
  text, numeric, text, text, uuid
) rename to convert_currency_balance;

grant execute on function public.convert_currency_balance(
  text, numeric, text, text, uuid
) to authenticated, service_role;

drop function public.open_accounts(integer[], text);
alter function public.open_accounts_before_required_checking(integer[], text)
  rename to open_accounts;

grant execute on function public.open_accounts(integer[], text)
  to authenticated, service_role;

-- The expanded conversion constraint is intentionally retained. New
-- Checking-to-currency ledger rows are immutable financial history and remain
-- valid after the new write path is removed.

commit;
