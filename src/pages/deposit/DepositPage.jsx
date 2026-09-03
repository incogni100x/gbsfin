import { useAuth } from "@/auth/useAuth.js";
import PageHeader from "@/components/ui/PageHeader.jsx";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import {
  ArrowRight01Icon,
  BankIcon,
  Invoice03Icon,
  MailAtSign02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AccountDepositDialog from "./AccountDepositDialog.jsx";
import CurrencyDepositSection from "./CurrencyDepositSection.jsx";
import DepositHistoryTable from "./DepositHistoryTable.jsx";
import StablecoinDepositSection from "./StablecoinDepositSection.jsx";
import {
  accountDepositHistoryQueryKey,
  accountDepositOptionsQueryKey,
  depositHistoryQueryKey,
  getAccountDepositHistory,
  getAccountDepositOptions,
  getDepositHistory,
} from "./depositService.js";

const depositMethods = [
  {
    description: "Deposit from one of your linked bank accounts.",
    icon: BankIcon,
    label: "Wire / ACH",
    method: "wire_ach",
  },
  {
    description: "Request deposit details from our payments team.",
    icon: MailAtSign02Icon,
    label: "Direct Deposit",
    method: "direct_deposit",
  },
  {
    description: "Upload a cheque for verification and approval.",
    icon: Invoice03Icon,
    label: "Cheque Deposit",
    method: "cheque",
  },
];

const methodLabels = {
  cheque: "Cheque Deposit",
  direct_deposit: "Direct Deposit",
  wire_ach: "Wire / ACH",
};

function normalizeCurrencyDeposit(deposit) {
  return {
    accountName: `${deposit.currency_code} balance`,
    accountNumber: null,
    amount: Number(deposit.amount),
    createdAt: deposit.created_at,
    currency: deposit.currency_code,
    id: `currency-${deposit.id}`,
    method: deposit.deposit_instructions?.payment_rail ?? "Currency Deposit",
    status: deposit.status,
  };
}

function normalizeAccountDeposit(deposit) {
  const isStablecoin = deposit.method === "stablecoin";
  return {
    accountName: deposit.user_accounts?.account_types?.name || "Account",
    accountNumber: deposit.user_accounts?.account_number || null,
    amount: Number(deposit.amount),
    createdAt: deposit.created_at,
    currency: isStablecoin
      ? deposit.currency_code
      : deposit.user_accounts?.currency_code || "USD",
    id: `account-${deposit.id}`,
    method: isStablecoin
      ? deposit.deposit_instructions?.network ||
        deposit.deposit_instructions?.payment_rail ||
        "Stablecoin Deposit"
      : methodLabels[deposit.method] || "Bank Deposit",
    reference: deposit.application_reference,
    status: deposit.status,
  };
}

function DepositMethodSkeleton() {
  return (
    <div className="h-40 animate-pulse rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)]" />
  );
}

function DepositPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const options = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getAccountDepositOptions(user.id),
    queryKey: accountDepositOptionsQueryKey(user?.id),
    staleTime: 30 * 1000,
  });
  const accountDeposits = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getAccountDepositHistory(user.id),
    queryKey: accountDepositHistoryQueryKey(user?.id),
    staleTime: 15 * 1000,
  });
  const currencyDeposits = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getDepositHistory(user.id),
    queryKey: depositHistoryQueryKey(user?.id),
    staleTime: 15 * 1000,
  });

  const refreshDeposits = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: accountDepositHistoryQueryKey(user?.id),
      }),
      queryClient.invalidateQueries({
        queryKey: depositHistoryQueryKey(user?.id),
      }),
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
    ]);

  const history = [
    ...(accountDeposits.data || []).map(normalizeAccountDeposit),
    ...(currencyDeposits.data || []).map(normalizeCurrencyDeposit),
  ].sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

  return (
    <section>
      <PageHeader
        description="Deposit directly into one of your Global Stripe Fin bank accounts."
        title="Deposits"
      />

      <section aria-labelledby="deposit-methods-heading">
        <div className="mb-4">
          <h2
            className="text-title-3-medium sm:text-title-2-medium"
            id="deposit-methods-heading"
          >
            Choose a deposit method
          </h2>
          <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
            Select how you want to add money to your bank account.
          </p>
        </div>

        {options.error ? (
          <p className="text-body-medium text-[var(--color-text-error-primary)]">
            {options.error.message || "Unable to load your bank accounts."}
          </p>
        ) : options.isPending ? (
          <div className="grid gap-4 md:grid-cols-3">
            {depositMethods.map((method) => (
              <DepositMethodSkeleton key={method.method} />
            ))}
          </div>
        ) : !options.data?.accounts.length ? (
          <div className="rounded-[var(--radius-2lg)] border border-dashed border-[var(--color-separator-border)] p-6">
            <p className="text-title-3-medium">No bank account available</p>
            <p className="text-body-medium mt-1 text-[var(--color-text-secondary)]">
              You need an active Global Stripe Fin account before making a
              deposit.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {depositMethods.map((method) => (
              <AccountDepositDialog
                accounts={options.data.accounts}
                key={method.method}
                linkedAccounts={options.data.linkedAccounts}
                method={method.method}
                onSubmitted={refreshDeposits}
                trigger={
                  <LayerCard className="w-full !bg-[var(--color-background-primary-default)] ring-[var(--color-separator-border)]">
                    <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3">
                      <span className="grid size-9 place-items-center rounded-full bg-[var(--color-accent-400)] text-white">
                        <HugeiconsIcon
                          aria-hidden="true"
                          icon={method.icon}
                          size={19}
                          strokeWidth={1.8}
                        />
                      </span>
                    </LayerCard.Secondary>
                    <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-4 ring-[var(--color-separator-border)]">
                      <span className="text-title-3-medium">
                        {method.label}
                      </span>
                      <span className="text-body-2-regular mt-1 text-[var(--color-text-secondary)]">
                        {method.description}
                      </span>
                      <span className="text-body-medium mt-4 inline-flex items-center gap-2 text-[var(--color-accent-700)]">
                        Start deposit
                        <HugeiconsIcon
                          aria-hidden="true"
                          icon={ArrowRight01Icon}
                          size={16}
                          strokeWidth={1.75}
                        />
                      </span>
                    </LayerCard.Primary>
                  </LayerCard>
                }
              />
            ))}
          </div>
        )}
      </section>

      <StablecoinDepositSection
        accounts={options.data?.accounts || []}
        onSubmitted={refreshDeposits}
      />

      <CurrencyDepositSection onSubmitted={refreshDeposits} />

      <section className="mt-8" aria-labelledby="deposit-history-heading">
        <h2
          className="text-title-3-medium mb-4 sm:text-title-2-medium"
          id="deposit-history-heading"
        >
          Deposit history
        </h2>
        <DepositHistoryTable deposits={history} />
      </section>
    </section>
  );
}

export default DepositPage;
