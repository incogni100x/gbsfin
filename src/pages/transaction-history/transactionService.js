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
  const [ledgerResult, depositsResult, transfersResult, withdrawalsResult] =
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
        .from("deposit_confirmations")
        .select("id, amount, currency_code, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(pageLimit),
      client
        .from("currency_transfers")
        .select(
          "id, source_currency_code, destination_currency_code, destination_type, source_amount, status, created_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(pageLimit),
      client
        .from("currency_withdrawals")
        .select("id, amount, currency_code, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(pageLimit),
    ]);

  [ledgerResult, depositsResult, transfersResult, withdrawalsResult].forEach(
    ({ error }) => {
      if (error) throw error;
    },
  );

  const ledger = ledgerResult.data.map((transaction) => ({
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
  const transfers = transfersResult.data.map((transfer) => ({
    accountName:
      transfer.destination_type === "bank_account"
        ? "Bank account"
        : `${transfer.destination_currency_code} balance`,
    amount: Number(transfer.source_amount),
    created_at: transfer.created_at,
    currency_code: transfer.source_currency_code,
    description:
      transfer.destination_type === "currency_balance_from_bank"
        ? "Bank account to USD balance"
        : `${transfer.source_currency_code} to ${transfer.destination_currency_code}`,
    direction: "debit",
    id: `transfer-${transfer.id}`,
    status: transfer.status,
    typeLabel: "Transfer",
  }));
  const withdrawals = withdrawalsResult.data.map((withdrawal) => ({
    ...withdrawal,
    accountName: `${withdrawal.currency_code} balance`,
    amount: Number(withdrawal.amount),
    description: `${withdrawal.currency_code} withdrawal`,
    direction: "debit",
    id: `withdrawal-${withdrawal.id}`,
    typeLabel: "Withdrawal",
  }));

  return [...ledger, ...deposits, ...transfers, ...withdrawals]
    .sort(
      (left, right) => new Date(right.created_at) - new Date(left.created_at),
    )
    .slice(0, pageLimit);
}
