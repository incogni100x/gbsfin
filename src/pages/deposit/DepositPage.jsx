import { Badge } from "@/components/base/badges/badge";
import { Button } from "@/components/base/buttons/button";
import { useAuth } from "@/auth/useAuth.js";
import PageHeader from "@/components/ui/PageHeader.jsx";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import CurrencyApplicationOverlay from "./CurrencyApplicationOverlay.jsx";
import DepositHistoryTable from "./DepositHistoryTable.jsx";
import DepositInstructionsDialog from "./DepositInstructionsDialog.jsx";
import {
  depositHistoryQueryKey,
  depositOverviewQueryKey,
  getDepositHistory,
  getDepositOverview,
  requestCurrencyAccess,
} from "./depositService.js";

function formatBalance(balance, currency) {
  return `${currency.symbol} ${balance.toLocaleString("en", {
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

function DepositPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAvailableCurrencies, setShowAvailableCurrencies] = useState(false);
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
  const { data: deposits = [] } = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getDepositHistory(user.id),
    queryKey: depositHistoryQueryKey(user?.id),
    staleTime: 15 * 1000,
  });
  const accessRequest = useMutation({
    mutationFn: requestCurrencyAccess,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: depositOverviewQueryKey(user?.id),
      }),
  });

  const refreshDeposits = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: depositHistoryQueryKey(user?.id),
      }),
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] }),
    ]);
  const enabledCurrencies = currencies.filter((currency) => currency.isEnabled);
  const unavailableCurrencies = currencies.filter(
    (currency) => !currency.isEnabled,
  );
  const visibleCurrencies = showAvailableCurrencies
    ? [...enabledCurrencies, ...unavailableCurrencies]
    : enabledCurrencies;

  return (
    <section>
      <PageHeader
        description="Add funds to an enabled currency balance or request access to another currency."
        title="Deposits"
      />
      <section aria-labelledby="currency-balances-heading">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
        <h2 className="text-title-3-medium sm:text-title-2-medium" id="currency-balances-heading">
          Currency balances
        </h2>
        <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
          Choose a balance to view its deposit instructions.
        </p>
        </div>
        {!isPending && unavailableCurrencies.length ? (
          <Button
            onClick={() => setShowAvailableCurrencies((current) => !current)}
            size="small"
            variant="secondary"
          >
            {showAvailableCurrencies
              ? "Show enabled currencies"
              : `Add another currency (${unavailableCurrencies.length})`}
          </Button>
        ) : null}
        </div>
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
              : visibleCurrencies.map((currency) => (
            <LayerCard
              className="w-full !bg-[var(--color-background-primary-default)] text-[var(--color-text-primary)] ring-[var(--color-separator-border)]"
              key={currency.code}
            >
              <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 text-[var(--color-text-secondary)]">
                <span className="text-body-medium">{currency.code}</span>
                <Badge
                  className={
                    currency.request?.status === "rejected"
                      ? "bg-[var(--color-background-tertiary-error)] text-[var(--color-text-error-primary)]"
                      : undefined
                  }
                  color={currency.isEnabled ? "primary" : "neutral"}
                >
                  {currency.isEnabled
                    ? "Available"
                    : currency.request?.status === "pending"
                      ? "Pending"
                      : currency.request?.status === "rejected"
                        ? "Rejected"
                        : "Not enabled"}
                </Badge>
              </LayerCard.Secondary>
              <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-4 ring-[var(--color-separator-border)]">
                <strong className="financial-number text-title-2-medium">
                  {formatBalance(currency.balance, currency)}
                </strong>
                <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                  {currency.name}
                </span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {currency.isEnabled ? (
                    <>
                      <DepositInstructionsDialog
                        currency={currency}
                        onSubmitted={refreshDeposits}
                      />
                    </>
                  ) : (
                    <CurrencyApplicationOverlay
                      currency={currency}
                      onRequest={(currencyCode) =>
                        accessRequest.mutateAsync(currencyCode)
                      }
                      requestStatus={currency.request?.status}
                    />
                  )}
                </div>
              </LayerCard.Primary>
            </LayerCard>
                ))}
          </div>
        )}
      </section>

      <section className="mt-8" aria-labelledby="deposit-history-heading">
        <h2
          className="text-title-3-medium mb-4 sm:text-title-2-medium"
          id="deposit-history-heading"
        >
          Deposit history
        </h2>
        <DepositHistoryTable deposits={deposits} />
      </section>
    </section>
  );
}

export default DepositPage;
