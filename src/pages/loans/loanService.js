import { requireSupabase } from "@/lib/supabase/client.js";

export const loanKeys = { all: (userId) => ["loans", userId], options: ["loan-options"] };
const check = (error) => { if (error) throw error; };

export async function getLoanOptions() {
  const client = requireSupabase();
  const [types, planEligibility, purposes, partners] = await Promise.all([
    client.from("loan_types").select("id, name, description, is_investment").eq("is_active", true).order("id"),
    client.from("loan_type_plans").select("loan_type_id, loan_plans!inner(id, duration_months, annual_interest_rate, is_active)"),
    client.from("loan_purposes").select("label").eq("is_active", true).order("display_order"),
    client.from("investment_loan_partners").select("name").eq("is_active", true).order("display_order"),
  ]);
  [types, planEligibility, purposes, partners].forEach(({ error }) => check(error));
  return {
    types: types.data,
    plans: planEligibility.data
      .filter((item) => item.loan_plans?.is_active)
      .map((item) => ({
        ...item.loan_plans,
        annual_interest_rate: Number(item.loan_plans.annual_interest_rate),
        loan_type_id: item.loan_type_id,
      }))
      .sort((left, right) => left.duration_months - right.duration_months),
    purposes: purposes.data.map((p) => p.label),
    partners: partners.data.map((p) => p.name),
  };
}

export async function getLoans(userId) {
  const { data, error } = await requireSupabase().from("loans")
    .select("id, amount, reason, status, annual_interest_rate, duration_months, monthly_payment, remaining_balance, remaining_months, next_due_date, overdue_amount, created_at, user_accounts(account_number, account_types(name)), loan_types(name)")
    .eq("user_id", userId).order("created_at", { ascending: false });
  check(error); return data.map((row) => ({ ...row, amount: Number(row.amount), monthly_payment: Number(row.monthly_payment), remaining_balance: Number(row.remaining_balance), overdue_amount: Number(row.overdue_amount) }));
}

export async function requestLoan({ accountId, amount, loanTypeId, planId, reason }) {
  const { data, error } = await requireSupabase().rpc("request_loan", { p_account_id: accountId, p_amount: amount, p_loan_type_id: loanTypeId, p_plan_id: planId, p_reason: reason });
  check(error); return data;
}
