import { requireSupabase } from "@/lib/supabase/client.js";

export const fixedDepositKeys = { all: (userId) => ["fixed-deposits", userId], rates: ["fixed-deposit-rates"] };
const check = (error) => { if (error) throw error; };

export async function getFixedDepositRates() {
  const { data, error } = await requireSupabase().from("fixed_deposit_rates").select("id, duration_months, monthly_rate").eq("is_active", true).order("duration_months");
  check(error); return data.map((row) => ({ ...row, monthly_rate: Number(row.monthly_rate) }));
}

export async function getFixedDeposits(userId) {
  const { data, error } = await requireSupabase().from("fixed_deposits")
    .select("id, account_id, amount, duration_months, monthly_rate, status, start_date, end_date, closure_requested_at, penalty_amount, created_at, user_accounts(account_number, account_types(name)), fixed_deposit_profits(profit_amount, finalized)")
    .eq("user_id", userId).order("created_at", { ascending: false });
  check(error);
  return data.map((row) => ({ ...row, amount: Number(row.amount), monthly_rate: Number(row.monthly_rate), penalty_amount: Number(row.penalty_amount), accruedProfit: (row.fixed_deposit_profits ?? []).reduce((sum, profit) => sum + Number(profit.profit_amount), 0) }));
}

export async function openFixedDeposit({ accountId, amount, rateId }) {
  const { data, error } = await requireSupabase().rpc("open_fixed_deposit", { p_account_id: accountId, p_amount: amount, p_rate_id: rateId });
  check(error); return data;
}

export async function requestFixedDepositClosure(depositId) {
  const { data, error } = await requireSupabase().rpc("request_fixed_deposit_closure", { p_fixed_deposit_id: depositId });
  check(error); return data;
}
