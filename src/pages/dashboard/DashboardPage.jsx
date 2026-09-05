import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BankIcon,
  ArrowRight01Icon,
  ShieldCheckIcon,
  Wallet02Icon,
} from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth.js";
import PageHeader from "@/components/ui/PageHeader.jsx";
import { Link } from "react-router";
import TransactionTable from "../transaction-history/TransactionTable.jsx";
import {
  getTransactions,
  transactionsQueryKey,
} from "../transaction-history/transactionService.js";
import {
  getCurrentUserAccounts,
  userAccountsQueryKey,
} from "./dashboardService.js";
import {
  depositOverviewQueryKey,
  getDepositOverview,
} from "../deposit/depositService.js";

function formatBalance(balance, currency) {
  return new Intl.NumberFormat("en-NG", {
    currency,
    maximumFractionDigits: currency === "NGN" ? 0 : 2,
    minimumFractionDigits: currency === "NGN" ? 0 : 2,
    style: "currency",
  }).format(balance);
}

function formatAccountLabel(name) {
  const normalizedName = name === "Offshire" ? "Offshore" : name;

  if (!normalizedName) return "Account";
  return /\baccount$/i.test(normalizedName)
    ? normalizedName
    : `${normalizedName} Account`;
}

function AccountCardSkeleton() {
  return (
    <LayerCard
      aria-busy="true"
      className="w-full !bg-[var(--color-background-primary-default)] ring-[var(--color-separator-border)]"
    >
      <span className="sr-only">Loading your accounts</span>
      <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 md:p-4">
        <span className="size-5 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" />
        <span className="h-5 w-28 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" />
      </LayerCard.Secondary>

      <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-3 ring-[var(--color-separator-border)] md:p-4">
        <span className="h-4 w-24 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" />
        <span className="mt-2 h-8 w-40 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" />
      </LayerCard.Primary>
    </LayerCard>
  );
}

function AccountNotice({ children, icon, title }) {
  return (
    <article className="flex items-start gap-3 rounded-[var(--radius-2lg)] border border-[color-mix(in_srgb,var(--color-separator-border)_65%,transparent)] p-4 sm:p-5">
      <span className="grid size-10 shrink-0 place-items-center text-[var(--color-accent-600)]">
        <HugeiconsIcon
          aria-hidden="true"
          icon={icon}
          size={21}
          strokeWidth={1.75}
        />
      </span>
      <div className="min-w-0">
        <h2 className="text-headline-medium text-[var(--color-text-primary)]">
          {title}
        </h2>
        <p className="mt-1 text-body-medium text-[var(--color-text-secondary)]">
          {children}
        </p>
      </div>
    </article>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const {
    data: accounts = [],
    error,
    isPending,
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
  const enabledCurrencies = currencies.filter(
    (currency) =>
      currency.isEnabled &&
      currency.currency_kind === "fiat" &&
      currency.code !== "USD",
  );

  return (
    <section className="mt-0 md:-mt-4">
      <PageHeader
        description="A current view of your accounts and latest activity."
        title="Overview"
      />
      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <AccountCardSkeleton key={index} />
          ))}
        </div>
      ) : error ? (
        <p className="text-body-medium text-[var(--color-text-error-primary)]">
          {error.message || "Unable to load your accounts."}
        </p>
      ) : accounts.length === 0 ? (
        <p className="text-body-medium text-[var(--color-text-secondary)]">
          No accounts are available yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <LayerCard
              key={account.id}
              className="w-full !bg-[var(--color-background-primary-default)] text-[var(--color-text-primary)] ring-[var(--color-separator-border)]"
            >
              <LayerCard.Secondary
                className="!bg-[var(--color-background-secondary-default)] px-4 py-3 text-[var(--color-text-secondary)] md:p-4"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  className="text-[var(--color-accent-600)]"
                  icon={Wallet02Icon}
                  size={20}
                  strokeWidth={1.75}
                />
                <span className="text-headline-medium">
                  {formatAccountLabel(account.name)}
                </span>
              </LayerCard.Secondary>

              <LayerCard.Primary
                className="!bg-[var(--color-accent-600)] px-4 py-3 text-[var(--color-neutral-50)] ring-[var(--color-separator-border)] md:p-4"
              >
                <span className="text-body-medium text-[var(--color-neutral-50)]">
                  Available balance
                </span>
                <strong className="financial-number text-title-2-medium sm:text-title-1-medium">
                  {formatBalance(account.balance, account.currency)}
                </strong>
              </LayerCard.Primary>
            </LayerCard>
          ))}
        </div>
      )}

      <section aria-labelledby="dashboard-currencies-heading" className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2
              className="text-title-3-medium sm:text-title-2-medium"
              id="dashboard-currencies-heading"
            >
              Currencies
            </h2>
            <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
              Your activated currency balances.
            </p>
          </div>
          <Link
            className="text-body-medium shrink-0 text-[var(--color-accent-600)] underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current"
            to="/deposit?show=available#currency-balances"
          >
            Manage
          </Link>
        </div>
        {currenciesPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <AccountCardSkeleton key={index} />
            ))}
          </div>
        ) : currenciesError ? (
          <p className="text-body-medium text-[var(--color-text-error-primary)]">
            {currenciesError.message || "Unable to load your currencies."}
          </p>
        ) : enabledCurrencies.length === 0 ? (
          <p className="text-body-medium text-[var(--color-text-secondary)]">
            No currencies are activated yet.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enabledCurrencies.map((currency) => (
              <LayerCard
                className="w-full !bg-[var(--color-background-primary-default)] text-[var(--color-text-primary)] ring-[var(--color-separator-border)]"
                key={currency.code}
              >
                <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 text-[var(--color-text-secondary)] md:p-4">
                  <HugeiconsIcon
                    aria-hidden="true"
                    className="text-[var(--color-accent-600)]"
                    icon={Wallet02Icon}
                    size={20}
                    strokeWidth={1.75}
                  />
                  <span className="text-headline-medium">{currency.code}</span>
                </LayerCard.Secondary>
                <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-3 ring-[var(--color-separator-border)] md:p-4">
                  <span className="text-body-medium text-[var(--color-text-secondary)]">
                    {currency.name}
                  </span>
                  <strong className="financial-number text-title-2-medium sm:text-title-1-medium">
                    {formatBalance(currency.balance, currency.code)}
                  </strong>
                </LayerCard.Primary>
              </LayerCard>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="quick-links-heading" className="mt-6">
        <h2 className="text-title-3-medium sm:text-title-2-medium" id="quick-links-heading">
          Quick links
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            className="text-body-medium inline-flex min-h-9 items-center gap-2 rounded-2lg bg-[var(--color-accent-600)] px-3 text-white no-underline transition-colors hover:bg-[var(--color-accent-500)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus-ring)]"
            to="/manage-accounts"
          >
            Manage accounts
            <HugeiconsIcon aria-hidden="true" icon={ArrowRight01Icon} size={16} strokeWidth={1.75} />
          </Link>
          <Link
            className="text-body-medium inline-flex min-h-9 items-center gap-2 rounded-2lg bg-[var(--color-accent-600)] px-3 text-white no-underline transition-colors hover:bg-[var(--color-accent-500)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus-ring)]"
            to="/deposit?show=available#currency-balances"
          >
            Add another currency
            <HugeiconsIcon aria-hidden="true" icon={ArrowRight01Icon} size={16} strokeWidth={1.75} />
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-title-3-medium sm:text-title-2-medium">
            Recent transactions
          </h2>
          <Link
            className="text-body-medium text-[var(--color-accent-600)] underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current"
            to="/transaction-history"
          >
            View all
          </Link>
        </div>
        {transactionsPending ? (
          <div className="h-40 animate-pulse rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] motion-reduce:animate-none" />
        ) : (
          <TransactionTable transactions={recentTransactions} />
        )}
      </section>

      <section
        aria-label="Account protection information"
        className="mt-6 grid gap-4 md:grid-cols-2"
      >
        <AccountNotice icon={ShieldCheckIcon} title="Security Status">
          Your account is protected with email verification, security questions,
          and verified sessions.
        </AccountNotice>
        <AccountNotice icon={BankIcon} title="FDIC">
          Your deposits are insured up to{" "}
          <span className="financial-number">US$250,000.00</span> per depositor,
          for each account ownership category.
        </AccountNotice>
      </section>
    </section>
  );
}

export default DashboardPage;
