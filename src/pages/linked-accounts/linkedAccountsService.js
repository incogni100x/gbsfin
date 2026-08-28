import { requireSupabase } from "@/lib/supabase/client.js";

const fields = "id, account_name, account_holder_name, bank_name, account_number, routing_number, iban, swift_code, country_code, currency_code, created_at";

function throwIfError(error) {
  if (error) throw error;
}

export const linkedAccountsQueryKey = (userId) => ["linked-bank-accounts", userId];

export async function getLinkedAccounts() {
  const { data, error } = await requireSupabase()
    .from("linked_bank_accounts")
    .select(fields)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return data;
}

export async function saveLinkedAccount({ id, ...account }) {
  const client = requireSupabase();
  if (id) {
    const { data, error } = await client
      .from("linked_bank_accounts")
      .update(account)
      .eq("id", id)
      .select(fields)
      .single();
    throwIfError(error);
    return data;
  }

  const { data: { user }, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  if (!user) throw new Error("Your session has expired. Please sign in again.");
  const { data, error } = await client
    .from("linked_bank_accounts")
    .insert({ ...account, user_id: user.id })
    .select(fields)
    .single();
  throwIfError(error);
  return data;
}

export async function deleteLinkedAccount(id) {
  const { error } = await requireSupabase()
    .from("linked_bank_accounts")
    .delete()
    .eq("id", id);
  throwIfError(error);
}
