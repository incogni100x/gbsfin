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

export function accountDepositOptionsQueryKey(userId) {
  return ["account-deposit-options", userId];
}

export function accountDepositHistoryQueryKey(userId) {
  return ["account-deposit-history", userId];
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
      .select("currency_code, status, review_note, application_reference")
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

export async function submitCurrencyDeposit({
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
    .from("currency_deposits")
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

export async function submitStablecoinDepositRequest({
  accountId,
  amount,
  currencyCode,
  instructionId,
  senderName,
}) {
  const client = requireSupabase();
  const { data, error } = await client.rpc(
    "submit_stablecoin_deposit_request",
    {
      p_account_id: accountId,
      p_amount: Number(amount),
      p_currency_code: currencyCode,
      p_instruction_id: instructionId,
      p_sender_name: senderName.trim(),
    },
  );

  throwIfError(error);
  return data;
}

export async function getDepositHistory(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("currency_deposits")
    .select(
      "id, amount, currency_code, status, created_at, deposit_instructions ( payment_rail )",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  throwIfError(error);
  return data;
}

export async function getAccountDepositOptions(userId) {
  const client = requireSupabase();
  const [accountsResult, linkedAccountsResult] = await Promise.all([
    client
      .from("user_accounts")
      .select("id, account_number, currency_code, account_types ( name )")
      .eq("user_id", userId)
      .order("created_at"),
    client
      .from("linked_bank_accounts")
      .select("id, account_name, bank_name, account_number, routing_number")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  throwIfError(accountsResult.error);
  throwIfError(linkedAccountsResult.error);

  return {
    accounts: accountsResult.data.map((account) => ({
      accountNumber: account.account_number,
      currency: account.currency_code,
      id: account.id,
      name: account.account_types?.name || "Account",
    })),
    linkedAccounts: linkedAccountsResult.data.map((account) => ({
      accountName: account.account_name,
      accountNumber: account.account_number,
      bankName: account.bank_name,
      id: account.id,
      routingNumber: account.routing_number,
    })),
  };
}

export async function getAccountDepositHistory(userId) {
  const client = requireSupabase();
  const { data, error } = await client
    .from("account_deposit_requests")
    .select(
      "id, amount, method, currency_code, sender_name, status, application_reference, created_at, deposit_instructions ( payment_rail, network ), user_accounts ( account_number, currency_code, account_types ( name ) )",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  throwIfError(error);
  return data;
}

function fileExtension(file) {
  return file.name.split(".").pop()?.toLowerCase() || "bin";
}

export async function submitAccountDepositRequest({
  accountId,
  amount,
  chequeFile,
  linkedBankAccountId,
  method,
}) {
  const client = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  throwIfError(userError);

  if (!user) throw new Error("Your session has expired. Please sign in again.");

  let chequeFilePath = null;

  if (method === "cheque") {
    if (!chequeFile)
      throw new Error("Choose a cheque image before continuing.");
    chequeFilePath = `${user.id}/${crypto.randomUUID()}.${fileExtension(chequeFile)}`;
    const { error: uploadError } = await client.storage
      .from("cheque-deposits")
      .upload(chequeFilePath, chequeFile, {
        contentType: chequeFile.type,
        upsert: false,
      });
    throwIfError(uploadError);
  }

  const { data, error } = await client.rpc("submit_account_deposit_request", {
    p_account_id: accountId,
    p_amount: Number(amount),
    p_cheque_file_path: chequeFilePath,
    p_linked_bank_account_id:
      method === "wire_ach" ? linkedBankAccountId : null,
    p_method: method,
  });

  if (error && chequeFilePath) {
    await client.storage.from("cheque-deposits").remove([chequeFilePath]);
  }

  throwIfError(error);
  return data;
}
