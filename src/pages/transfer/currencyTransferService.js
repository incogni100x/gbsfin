import { requireSupabase } from "@/lib/supabase/client.js";

function throwIfError(error) {
  if (error) throw error;
}

export const currencyTransfersQueryKey = (userId) => ["currency-transfers", userId];
export const bankTransfersQueryKey = (userId) => ["bank-transfers", userId];
export const beneficiariesQueryKey = (userId) => ["bank-beneficiaries", userId];

export async function createCurrencyConversion({
  amount,
  destinationAccountId,
  destinationCurrencyCode,
  destinationType,
  sourceCurrencyCode,
}) {
  const { data, error } = await requireSupabase().rpc("convert_currency_balance", {
    p_amount: Number(amount),
    p_destination_account_id: destinationAccountId || null,
    p_destination_currency_code: destinationCurrencyCode,
    p_destination_type: destinationType,
    p_source_currency_code: sourceCurrencyCode,
  });
  throwIfError(error);
  return { ...data, destination_amount: Number(data.destination_amount), exchange_rate: Number(data.exchange_rate), source_amount: Number(data.source_amount) };
}

export async function requestCurrencyTransfer({ amount, currencyCode, details }) {
  const { data, error } = await requireSupabase().rpc("request_currency_transfer", {
    p_account_holder_name: details.accountHolderName || null,
    p_account_number: details.accountNumber || null,
    p_account_type: details.accountType || null,
    p_amount: Number(amount),
    p_bank_address: details.bankAddress || null,
    p_bank_name: details.bankName || null,
    p_beneficiary_address: details.beneficiaryAddress || null,
    p_bsb: details.bsb || null,
    p_clabe: details.clabe || null,
    p_currency_code: currencyCode,
    p_iban: details.iban || null,
    p_network: details.network || null,
    p_routing_number: details.routingNumber || null,
    p_sort_code: details.sortCode || null,
    p_swift_bic: details.swiftBic || null,
    p_wallet_address: details.walletAddress || null,
  });
  throwIfError(error);
  return { ...data, amount: Number(data.amount) };
}

export async function getCurrencyTransfers(userId) {
  const { data, error } = await requireSupabase().from("currency_transfers")
    .select("id, currency_code, amount, status, account_holder_name, bank_name, account_number, iban, wallet_address, network, review_note, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false });
  throwIfError(error);
  return data.map((transfer) => ({ ...transfer, amount: Number(transfer.amount) }));
}

export async function getBankBeneficiaries(userId) {
  const { data, error } = await requireSupabase().from("bank_beneficiaries")
    .select("id, account_type, account_name, bank_name, account_number, routing_number, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false });
  throwIfError(error);
  return data;
}

export async function createBankBeneficiary(beneficiary) {
  const client = requireSupabase();
  const { data: { user }, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  if (!user) throw new Error("Your session has expired. Please sign in again.");
  const { data, error } = await client.from("bank_beneficiaries")
    .insert({ ...beneficiary, user_id: user.id })
    .select("id, account_type, account_name, bank_name, account_number, routing_number, created_at").single();
  throwIfError(error);
  return data;
}

export async function submitBankTransfer({ amount, destinationId, destinationKind, sourceAccountId }) {
  const { data, error } = await requireSupabase().rpc("submit_bank_transfer", {
    p_amount: Number(amount), p_destination_id: destinationId,
    p_destination_kind: destinationKind, p_source_account_id: sourceAccountId,
  });
  throwIfError(error);
  return { ...data, amount: Number(data.amount) };
}

export async function getBankTransfers(userId) {
  const { data, error } = await requireSupabase().from("bank_transfers")
    .select("id, source_account_id, destination_kind, recipient_name, recipient_bank_name, recipient_account_number, amount, currency_code, status, application_reference, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false });
  throwIfError(error);
  return data.map((transfer) => ({ ...transfer, amount: Number(transfer.amount) }));
}
