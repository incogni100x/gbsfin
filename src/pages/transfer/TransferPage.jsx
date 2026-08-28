import { Badge } from "@/components/base/badges/badge";
import { useAuth } from "@/auth/useAuth.js";
import CurrencyTransferPopover from "@/pages/deposit/CurrencyTransferPopover.jsx";
import {
  depositOverviewQueryKey,
  getDepositOverview,
} from "@/pages/deposit/depositService.js";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useQuery } from "@tanstack/react-query";
import ContentSkeleton from "@/components/ui/ContentSkeleton.jsx";
import PageHeader from "@/components/ui/PageHeader.jsx";
import {
  getCurrentUserAccounts,
  userAccountsQueryKey,
} from "@/pages/dashboard/dashboardService.js";
import BankToUsdTransferDialog from "./BankToUsdTransferDialog.jsx";
import WithdrawalDialog from "./WithdrawalDialog.jsx";
import WithdrawalHistoryTable from "./WithdrawalHistoryTable.jsx";
import {
  currencyWithdrawalsQueryKey,
  getCurrencyWithdrawals,
} from "./currencyTransferService.js";

function formatBalance(currency) {
  return `${currency.symbol} ${currency.balance.toLocaleString("en", {
    maximumFractionDigits: currency.currency_kind === "stablecoin" ? 6 : 2,
    minimumFractionDigits: 2,
  })}`;
}

function CurrencyCardSkeleton() {
  return (
    <LayerCard className="w-full !bg-[var(--color-background-primary-default)] ring-[var(--color-separator-border)]">
      <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3">
        <span className="h-5 w-14 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" />
      </LayerCard.Secondary>
      <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-4 ring-[var(--color-separator-border)]">
        <span className="h-7 w-32 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" />
        <span className="h-4 w-24 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" />
      </LayerCard.Primary>
    </LayerCard>
  );
}

function TransferPage() {
  const { user } = useAuth();
  const {
    data: currencies = [],
    error,
    isPending,
  } = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getDepositOverview(user.id),
    queryKey: depositOverviewQueryKey(user?.id),
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });
  const { data: withdrawals = [] } = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getCurrencyWithdrawals(user.id),
    queryKey: currencyWithdrawalsQueryKey(user?.id),
    staleTime: 15 * 1000,
  });
  const { data: bankAccounts = [], isPending: accountsPending } = useQuery({
    enabled: Boolean(user?.id),
    queryFn: getCurrentUserAccounts,
    queryKey: userAccountsQueryKey(user?.id),
    staleTime: 30 * 1000,
  });
  const enabledCurrencies = currencies.filter((currency) => currency.isEnabled);
  const usdBankAccounts = bankAccounts.filter(
    (account) => account.currency === "USD",
  );

  return (
    <section>
      <PageHeader
        description="Move money between your bank and currency balances, or request a withdrawal."
        title="Transfers"
      />
      <section aria-labelledby="bank-account-transfers-heading">
        <h2
          className="text-title-3-medium sm:text-title-2-medium"
          id="bank-account-transfers-heading"
        >
          Bank accounts
        </h2>
        <p className="text-body-2-medium mt-1 mb-4 text-[var(--color-text-secondary)]">
          Transfer from a USD bank account into your USD currency balance.
        </p>
        {accountsPending ? (
          <ContentSkeleton label="Loading bank accounts" />
        ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {usdBankAccounts.map((account) => (
            <LayerCard
              className="w-full !bg-[var(--color-background-primary-default)] text-[var(--color-text-primary)] ring-[var(--color-separator-border)]"
              key={account.id}
            >
              <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 text-[var(--color-text-secondary)]">
                <span className="text-body-medium">{account.name}</span>
                <span className="text-body-2-medium">
                  •••• {account.accountNumber.slice(-4)}
                </span>
              </LayerCard.Secondary>
              <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-4 ring-[var(--color-separator-border)]">
                <strong className="financial-number text-title-2-medium">
                  {account.balance.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}
                </strong>
                <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                  Available balance
                </span>
                <div className="mt-3">
                  <BankToUsdTransferDialog account={account} />
                </div>
              </LayerCard.Primary>
            </LayerCard>
          ))}
        </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="transfer-balances-heading">
        <h2
          className="text-title-3-medium sm:text-title-2-medium"
          id="transfer-balances-heading"
        >
          Currency balances
        </h2>
        <p className="text-body-2-medium mt-1 mb-4 text-[var(--color-text-secondary)]">
          Transfer between enabled currencies or withdraw to an external account.
        </p>
        {error ? (
          <p className="text-body-medium text-[var(--color-text-error-primary)]">
            {error.message || "Unable to load your currency balances."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {isPending
              ? Array.from({ length: 6 }, (_, index) => (
                  <CurrencyCardSkeleton key={index} />
                ))
              : enabledCurrencies.map((currency) => (
                  <LayerCard
                    className="w-full !bg-[var(--color-background-primary-default)] text-[var(--color-text-primary)] ring-[var(--color-separator-border)]"
                    key={currency.code}
                  >
                    <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 text-[var(--color-text-secondary)]">
                      <span className="text-body-medium">{currency.code}</span>
                      <Badge color="primary">Available</Badge>
                    </LayerCard.Secondary>
                    <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-4 ring-[var(--color-separator-border)]">
                      <strong className="financial-number text-title-2-medium">
                        {formatBalance(currency)}
                      </strong>
                      <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                        {currency.name}
                      </span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <CurrencyTransferPopover
                          availableCurrencies={enabledCurrencies}
                          currency={currency}
                        />
                        <WithdrawalDialog currency={currency} />
                      </div>
                    </LayerCard.Primary>
                  </LayerCard>
                ))}
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="withdrawal-history-heading">
        <h2
          className="text-title-3-medium mb-4 sm:text-title-2-medium"
          id="withdrawal-history-heading"
        >
          Withdrawal history
        </h2>
        <WithdrawalHistoryTable withdrawals={withdrawals} />
      </section>
    </section>
  );
}

export default TransferPage;
