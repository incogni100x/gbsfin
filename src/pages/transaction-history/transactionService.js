import { requireSupabase } from "@/lib/supabase/client.js";

export function transactionsQueryKey(userId, limit = "all") {
  return ["transactions", userId, limit];
}

function humanize(value) {
  return String(value || "Transaction")
    .replaceAll("_", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export async function getTransactions(userId, { limit = 200 } = {}) {
  const client = requireSupabase();
  const pageLimit = limit || 200;
  const [
    ledgerResult,
    depositsResult,
    accountDepositsResult,
    conversionsResult,
    currencyTransfersResult,
    bankTransfersResult,
  ] =
    await Promise.all([
      client
        .from("transactions")
        .select(
          "id, type, direction, amount, currency_code, status, note, created_at, user_accounts ( account_number, account_types ( name ) )",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(pageLimit),
      client
        .from("currency_deposits")
        .select("id, amount, currency_code, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(pageLimit),
      client
        .from("account_deposit_requests")
        .select(
          "id, amount, method, currency_code, status, created_at, deposit_instructions ( payment_rail, network ), user_accounts ( account_number, currency_code, account_types ( name ) )",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(pageLimit),
      client
        .from("currency_conversions")
        .select(
          "id, source_currency_code, destination_currency_code, destination_type, source_amount, status, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(pageLimit),
      client
        .from("currency_transfers")
        .select("id, amount, currency_code, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(pageLimit),
      client
        .from("bank_transfers")
        .select("id, amount, currency_code, status, recipient_name, recipient_bank_name, application_reference, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(pageLimit),
    ]);

  [
    ledgerResult,
    depositsResult,
    accountDepositsResult,
    conversionsResult,
    currencyTransfersResult,
    bankTransfersResult,
  ].forEach(({ error }) => {
    if (error) throw error;
  });

  const ledger = ledgerResult.data
    .filter((transaction) => transaction.type !== "account_deposit")
    .map((transaction) => ({
      ...transaction,
      id: `ledger-${transaction.id}`,
      accountName: transaction.user_accounts?.account_types?.name || "Account",
      accountNumber: transaction.user_accounts?.account_number || null,
      amount: Number(transaction.amount),
      description: transaction.note || humanize(transaction.type),
      typeLabel: humanize(transaction.type),
    }));
  const deposits = depositsResult.data.map((deposit) => ({
    ...deposit,
    accountName: `${deposit.currency_code} balance`,
    amount: Number(deposit.amount),
    description: `${deposit.currency_code} deposit`,
    direction: "credit",
    id: `deposit-${deposit.id}`,
    typeLabel: "Deposit",
  }));
  const accountDeposits = accountDepositsResult.data.map((deposit) => ({
    accountName: deposit.user_accounts?.account_types?.name || "Account",
    accountNumber: deposit.user_accounts?.account_number || null,
    amount: Number(deposit.amount),
    created_at: deposit.created_at,
    currency_code:
      deposit.method === "stablecoin"
        ? deposit.currency_code
        : deposit.user_accounts?.currency_code || "USD",
    description:
      deposit.method === "wire_ach"
        ? "Wire / ACH deposit"
        : deposit.method === "cheque"
          ? "Check Deposit"
          : deposit.method === "stablecoin"
            ? `${deposit.currency_code} stablecoin deposit`
            : "Direct deposit",
    direction: "credit",
    id: `account-deposit-${deposit.id}`,
    status: deposit.status,
    typeLabel: "Deposit",
  }));
  const conversions = conversionsResult.data.map((conversion) => ({
    accountName:
      conversion.destination_type === "bank_account"
        ? "Bank account"
        : `${conversion.destination_currency_code} balance`,
    amount: Number(conversion.source_amount),
    created_at: conversion.created_at,
    currency_code: conversion.source_currency_code,
    description:
      conversion.destination_type === "currency_balance_from_bank"
        ? "Bank account to USD balance"
        : `${conversion.source_currency_code} to ${conversion.destination_currency_code}`,
    direction: "debit",
    id: `conversion-${conversion.id}`,
    status: conversion.status,
    typeLabel: "Conversion",
  }));
  const currencyTransfers = currencyTransfersResult.data.map((transfer) => ({
    ...transfer,
    accountName: `${transfer.currency_code} balance`,
    amount: Number(transfer.amount),
    description: `${transfer.currency_code} transfer`,
    direction: "debit",
    id: `currency-transfer-${transfer.id}`,
    typeLabel: "Transfer",
  }));
  const bankTransfers = bankTransfersResult.data.map((transfer) => ({
    accountName: transfer.recipient_name,
    amount: Number(transfer.amount),
    created_at: transfer.created_at,
    currency_code: transfer.currency_code,
    description: `${transfer.recipient_bank_name} · ${transfer.application_reference}`,
    direction: "debit",
    id: `bank-transfer-${transfer.id}`,
    status: transfer.status,
    typeLabel: "Bank transfer",
  }));

  return [
    ...ledger,
    ...deposits,
    ...accountDeposits,
    ...conversions,
    ...currencyTransfers,
    ...bankTransfers,
  ]
    .sort(
      (left, right) => new Date(right.created_at) - new Date(left.created_at),
    )
    .slice(0, pageLimit);
}
