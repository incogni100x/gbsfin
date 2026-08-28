import { requireSupabase } from "@/lib/supabase/client.js";

function throwIfError(error) {
  if (error) throw error;
}

export async function createCurrencyTransfer({
  amount,
  destinationAccountId = null,
  destinationCurrencyCode = null,
  destinationType,
  sourceCurrencyCode,
}) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("transfer_currency_balance", {
    p_amount: Number(amount),
    p_destination_account_id: destinationAccountId,
    p_destination_currency_code: destinationCurrencyCode,
    p_destination_type:
      destinationType === "account" ? "bank_account" : "currency_balance",
    p_source_currency_code: sourceCurrencyCode,
  });

  throwIfError(error);

  return {
    ...data,
    destination_amount: Number(data.destination_amount),
    exchange_rate: Number(data.exchange_rate),
    source_amount: Number(data.source_amount),
  };
}

export async function transferBankAccountToUsdBalance({ accountId, amount }) {
  const client = requireSupabase();
  const { data, error } = await client.rpc(
    "transfer_bank_account_to_usd_balance",
    {
      p_amount: Number(amount),
      p_source_account_id: accountId,
    },
  );

  throwIfError(error);

  return {
    ...data,
    destination_amount: Number(data.destination_amount),
    exchange_rate: Number(data.exchange_rate),
    source_amount: Number(data.source_amount),
  };
}

export function currencyWithdrawalsQueryKey(userId) {
  return ["currency-withdrawals", userId];
}

export async function requestCurrencyWithdrawal({
  amount,
  currencyCode,
  details,
}) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("request_currency_withdrawal", {
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

export async function getCurrencyWithdrawals(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("currency_withdrawals")
    .select(
      "id, currency_code, amount, status, account_holder_name, bank_name, account_number, iban, wallet_address, network, review_note, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  throwIfError(error);

  return data.map((withdrawal) => ({
    ...withdrawal,
    amount: Number(withdrawal.amount),
  }));
}
