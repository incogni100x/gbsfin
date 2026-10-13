import { requireSupabase } from "@/lib/supabase/client.js";

const fields =
  "id, account_type, account_name, bank_name, account_number, routing_number, swift_code, address, transfer_scope, created_at";

function throwIfError(error) {
  if (error) throw error;
}

export const linkedAccountsQueryKey = (userId) => [
  "linked-bank-accounts",
  userId,
];

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
  const record = {
    account_name: account.account_name,
    account_number: account.account_number,
    account_type: account.account_type,
    address: account.address,
    bank_name: account.bank_name,
    routing_number: account.routing_number,
    swift_code: account.swift_code,
    transfer_scope: account.transfer_scope,
  };

  if (id) {
    // A linked account's transfer scope is immutable after creation. Omitting it
    // here also prevents a stale client form from reclassifying the recipient.
    const editableRecord = {
      account_name: record.account_name,
      account_number: record.account_number,
      account_type: record.account_type,
      address: record.address,
      bank_name: record.bank_name,
      routing_number: record.routing_number,
      swift_code: record.swift_code,
    };
    const { data, error } = await client
      .from("linked_bank_accounts")
      .update(editableRecord)
      .eq("id", id)
      .select(fields)
      .single();
    throwIfError(error);
    return data;
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  throwIfError(userError);
  if (!user) throw new Error("Your session has expired. Please sign in again.");
  const { data, error } = await client
    .from("linked_bank_accounts")
    .insert({
      ...record,
      user_id: user.id,
    })
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
