import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth.js";
import PageHeader from "@/components/ui/PageHeader.jsx";
import {
  depositHistoryQueryKey,
  depositOverviewQueryKey,
  getDepositOverview,
} from "../deposit/depositService.js";
import {
  getTransactions,
  transactionsQueryKey,
} from "../transaction-history/transactionService.js";
import AccountOverviewSection from "./AccountOverviewSection.jsx";
import AccountProtectionSection from "./AccountProtectionSection.jsx";
import CurrencyBalancesSection from "./CurrencyBalancesSection.jsx";
import {
  getCurrentUserAccounts,
  userAccountsQueryKey,
} from "./dashboardService.js";
import QuickLinksSection from "./QuickLinksSection.jsx";
import RecentTransactionsSection from "./RecentTransactionsSection.jsx";

function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    data: accounts = [],
    error: accountsError,
    isPending: accountsPending,
  } = useQuery({
    enabled: Boolean(user?.id),
    queryFn: getCurrentUserAccounts,
    queryKey: userAccountsQueryKey(user?.id),
    staleTime: 30 * 1000,
  });
  const { data: recentTransactions = [], isPending: transactionsPending } =
    useQuery({
      enabled: Boolean(user?.id),
      queryFn: () => getTransactions(user.id, { limit: 3 }),
      queryKey: transactionsQueryKey(user?.id, 3),
      staleTime: 30 * 1000,
    });
  const {
    data: currencies = [],
    error: currenciesError,
    isPending: currenciesPending,
  } = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getDepositOverview(user.id),
    queryKey: depositOverviewQueryKey(user?.id),
    staleTime: 30 * 1000,
  });

  const refreshCurrencyDeposits = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: depositOverviewQueryKey(user?.id),
      }),
      queryClient.invalidateQueries({
        queryKey: depositHistoryQueryKey(user?.id),
      }),
      queryClient.invalidateQueries({
        queryKey: transactionsQueryKey(user?.id, 3),
      }),
    ]);
  };

  return (
    <section className="mt-0 md:-mt-4">
      <PageHeader
        description="A current view of your accounts and latest activity."
        title="Overview"
      />
      <AccountOverviewSection
        accounts={accounts}
        error={accountsError}
        isPending={accountsPending}
      />
      <CurrencyBalancesSection
        currencies={currencies}
        error={currenciesError}
        isPending={currenciesPending}
        onDepositSubmitted={refreshCurrencyDeposits}
      />
      <QuickLinksSection />
      <RecentTransactionsSection
        isPending={transactionsPending}
        transactions={recentTransactions}
      />
      <AccountProtectionSection />
    </section>
  );
}

export default DashboardPage;
