begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rollback$
declare
  v_definition text;
  v_old_clause constant text := E'    and currency.currency_kind = ''fiat''\n';
  v_new_clause constant text := E'    and currency.currency_kind = ''fiat''\n    and currency.is_active\n';
begin
  select pg_get_functiondef(
    'public.make_loan_payment(uuid,uuid,numeric,uuid)'::regprocedure
  ) into v_definition;

  if strpos(v_definition, v_old_clause) = 0 then
    raise exception 'Expected loan payment account validation was not found';
  end if;

  execute replace(v_definition, v_old_clause, v_new_clause);
end;
$rollback$;

commit;
