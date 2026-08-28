import { requireSupabase } from "@/lib/supabase/client.js";

export function depositOverviewQueryKey(userId) {
  return ["deposit-overview", userId];
}

export function depositHistoryQueryKey(userId) {
  return ["deposit-history", userId];
}

export function depositInstructionsQueryKey(currencyCode) {
  return ["deposit-instructions", currencyCode];
}

function throwIfError(error) {
  if (error) throw error;
}

export async function getDepositOverview(userId) {
  const client = requireSupabase();
  const [currenciesResult, balancesResult, requestsResult] = await Promise.all([
    client
      .from("currencies")
      .select("code, name, symbol, currency_kind, display_order")
      .order("display_order"),
    client
      .from("user_currency_balances")
      .select("currency_code, balance")
      .eq("user_id", userId),
    client
      .from("currency_access_requests")
      .select("currency_code, status, review_note")
      .eq("user_id", userId),
  ]);

  throwIfError(currenciesResult.error);
  throwIfError(balancesResult.error);
  throwIfError(requestsResult.error);

  const balances = new Map(
    balancesResult.data.map((balance) => [
      balance.currency_code,
      Number(balance.balance),
    ]),
  );
  const requests = new Map(
    requestsResult.data.map((request) => [request.currency_code, request]),
  );

  return currenciesResult.data.map((currency) => ({
    ...currency,
    balance: balances.get(currency.code) ?? 0,
    isEnabled: balances.has(currency.code),
    request: requests.get(currency.code) ?? null,
  }));
}

export async function requestCurrencyAccess(currencyCode) {
  const client = requireSupabase();
  const { data, error } = await client.rpc("request_currency_access", {
    p_currency_code: currencyCode,
  });

  throwIfError(error);
  return data;
}

export async function getDepositInstructions(currencyCode) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("deposit_instructions")
    .select(
      "id, currency_code, payment_rail, beneficiary_name, account_number, routing_number, iban, swift_bic, sort_code, bsb, clabe, wallet_address, network",
    )
    .eq("currency_code", currencyCode)
    .eq("is_active", true)
    .order("payment_rail");

  throwIfError(error);
  return data;
}

export async function submitDepositConfirmation({
  amount,
  currencyCode,
  instructionId,
  senderName,
}) {
  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  throwIfError(userError);

  if (!user) throw new Error("Your session has expired. Please sign in again.");

  const { data, error } = await client
    .from("deposit_confirmations")
    .insert({
      amount: Number(amount),
      currency_code: currencyCode,
      instruction_id: instructionId,
      sender_name: senderName.trim(),
      user_id: user.id,
    })
    .select("id, status")
    .single();

  throwIfError(error);
  return data;
}

export async function getDepositHistory(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("deposit_confirmations")
    .select(
      "id, amount, currency_code, status, created_at, deposit_instructions ( payment_rail )",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  throwIfError(error);
  return data;
}
