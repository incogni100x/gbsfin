import { requireSupabase } from "@/lib/supabase/client.js";

export function userAccountsQueryKey(userId) {
  return ["user-accounts", userId];
}

function throwIfError(error) {
  if (error) throw error;
}

export async function getCurrentUserAccounts() {
  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  throwIfError(userError);

  if (!user) throw new Error("Your session has expired. Please sign in again.");

  const { data, error } = await client
    .from("user_accounts")
    .select(
      "id, account_number, balance, currency_code, created_at, account_types ( name )",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  throwIfError(error);

  return data.map((account) => ({
    balance: Number(account.balance),
    currency: account.currency_code,
    id: account.id,
    name: account.account_types?.name || "Account",
    accountNumber: account.account_number,
  }));
}
