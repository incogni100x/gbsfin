import { useAuth } from "@/auth/useAuth.js";
import ContentSkeleton from "@/components/ui/ContentSkeleton.jsx";
import PageHeader from "@/components/ui/PageHeader.jsx";
import { getCurrentUserAccounts, userAccountsQueryKey } from "@/pages/dashboard/dashboardService.js";
import { depositOverviewQueryKey, getDepositOverview } from "@/pages/deposit/depositService.js";
import { getLinkedAccounts, linkedAccountsQueryKey } from "@/pages/linked-accounts/linkedAccountsService.js";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useQuery } from "@tanstack/react-query";
import BankTransferDialog from "./BankTransferDialog.jsx";
import BankTransferHistoryTable from "./BankTransferHistoryTable.jsx";
import CheckingCurrencyConversionDialog from "./CheckingCurrencyConversionDialog.jsx";
import CurrencyConversionDialog from "./CurrencyConversionDialog.jsx";
import CurrencyTransferDialog from "./WithdrawalDialog.jsx";
import CurrencyTransferHistoryTable from "./WithdrawalHistoryTable.jsx";
import {
  bankTransfersQueryKey,
  currencyTransfersQueryKey,
  getBankTransfers,
  getCurrencyTransfers,
} from "./currencyTransferService.js";

function formatCurrency(value, code) {
  return Number(value).toLocaleString("en", { style: "currency", currency: code });
}

function CurrencyCardSkeleton() {
  return <LayerCard className="w-full !bg-[var(--color-background-primary-default)] ring-[var(--color-separator-border)]"><LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3"><span className="h-5 w-14 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" /></LayerCard.Secondary><LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-4 ring-[var(--color-separator-border)]"><span className="h-7 w-32 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" /><span className="h-4 w-24 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" /></LayerCard.Primary></LayerCard>;
}

export default function TransferPage() {
  const { user } = useAuth();
  const enabled = Boolean(user?.id);
  const { data: currencies = [], error, isPending } = useQuery({ enabled, queryFn: () => getDepositOverview(user.id), queryKey: depositOverviewQueryKey(user?.id), refetchInterval: 30_000, staleTime: 15_000 });
  const { data: accounts = [], isPending: accountsPending } = useQuery({ enabled, queryFn: getCurrentUserAccounts, queryKey: userAccountsQueryKey(user?.id), staleTime: 30_000 });
  const { data: linkedAccounts = [] } = useQuery({ enabled, queryFn: getLinkedAccounts, queryKey: linkedAccountsQueryKey(user?.id), staleTime: 30_000 });
  const { data: bankTransfers = [] } = useQuery({ enabled, queryFn: () => getBankTransfers(user.id), queryKey: bankTransfersQueryKey(user?.id), staleTime: 15_000 });
  const { data: currencyTransfers = [] } = useQuery({ enabled, queryFn: () => getCurrencyTransfers(user.id), queryKey: currencyTransfersQueryKey(user?.id), staleTime: 15_000 });
  const enabledCurrencies = currencies.filter(
    (currency) =>
      currency.isEnabled &&
      currency.currency_kind === "fiat" &&
      currency.code !== "USD",
  );
  const checkingAccounts = accounts.filter(
    (account) =>
      account.currency === "USD" && account.name.trim().toLowerCase() === "checking",
  );

  return <section>
    <PageHeader title="Transfers" description="Move money between bank accounts, convert Checking and currency balances, or transfer a currency balance to an external recipient." />

    <section aria-labelledby="bank-transfers-heading">
      <h2 className="text-title-3-medium sm:text-title-2-medium" id="bank-transfers-heading">Bank accounts</h2>
      <p className="text-body-2-medium mt-1 mb-4 text-[var(--color-text-secondary)]">Transfers between your own non-escrow accounts complete immediately. Checking can also be converted into an activated currency.</p>
      {accountsPending ? <ContentSkeleton label="Loading bank accounts" /> : accounts.length === 0 ? <p className="text-body-medium text-[var(--color-text-secondary)]">No bank accounts are available.</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((account) => <LayerCard className="w-full !bg-[var(--color-background-primary-default)] text-[var(--color-text-primary)] ring-[var(--color-separator-border)]" key={account.id}>
          <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 text-[var(--color-text-secondary)]"><span className="text-body-medium">{account.name} Account</span><span className="text-body-2-medium">•••• {account.accountNumber.slice(-4)}</span></LayerCard.Secondary>
          <LayerCard.Primary className="!bg-[var(--color-accent-600)] px-4 py-4 text-[var(--color-neutral-50)] ring-[var(--color-separator-border)]"><strong className="financial-number text-title-2-medium">{formatCurrency(account.balance, account.currency)}</strong><span className="text-body-2-medium text-[var(--color-neutral-50)]">Available balance</span><div className="mt-3 flex flex-wrap gap-2"><BankTransferDialog account={account} accounts={accounts} linkedAccounts={linkedAccounts} />{account.name.trim().toLowerCase() === "checking" ? <CheckingCurrencyConversionDialog account={account} availableCurrencies={enabledCurrencies} /> : null}</div></LayerCard.Primary>
        </LayerCard>)}
      </div>}
    </section>

    <section className="mt-8" aria-labelledby="currency-balances-heading">
      <h2 className="text-title-3-medium sm:text-title-2-medium" id="currency-balances-heading">Currency balances</h2>
      <p className="text-body-2-medium mt-1 mb-4 text-[var(--color-text-secondary)]">Convert an enabled currency into another currency balance or your Checking account.</p>
      {error ? <p className="text-body-medium text-[var(--color-text-error-primary)]">{error.message || "Unable to load your currency balances."}</p> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isPending ? Array.from({ length: 6 }, (_, index) => <CurrencyCardSkeleton key={index} />) : enabledCurrencies.map((currency) => <LayerCard className="w-full !bg-[var(--color-background-primary-default)] text-[var(--color-text-primary)] ring-[var(--color-separator-border)]" key={currency.code}>
          <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 text-[var(--color-text-secondary)]"><span className="text-body-medium">{currency.code}</span></LayerCard.Secondary>
          <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-4 ring-[var(--color-separator-border)]"><strong className="financial-number text-title-2-medium">{currency.symbol} {currency.balance.toLocaleString("en", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}</strong><span className="text-body-2-medium text-[var(--color-text-secondary)]">{currency.name}</span><div className="mt-3 flex flex-wrap gap-2"><CurrencyConversionDialog availableCurrencies={enabledCurrencies} checkingAccounts={checkingAccounts} currency={currency} /><CurrencyTransferDialog currency={currency} /></div></LayerCard.Primary>
        </LayerCard>)}
      </div>}
    </section>

    <section className="mt-8" aria-labelledby="bank-history-heading"><h2 className="text-title-3-medium mb-4 sm:text-title-2-medium" id="bank-history-heading">Bank transfer history</h2><BankTransferHistoryTable transfers={bankTransfers} /></section>
    <section className="mt-8" aria-labelledby="currency-history-heading"><h2 className="text-title-3-medium mb-4 sm:text-title-2-medium" id="currency-history-heading">Currency transfer history</h2><CurrencyTransferHistoryTable transfers={currencyTransfers} /></section>
  </section>;
}
