import { useAuth } from "@/auth/useAuth.js";
import { Badge } from "@/components/base/badges/badge";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CurrencyApplicationOverlay from "./CurrencyApplicationOverlay.jsx";
import DepositInstructionsDialog from "./DepositInstructionsDialog.jsx";
import {
  depositOverviewQueryKey,
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

const featuredCurrencyOrder = [];

function orderCurrencies(currencies) {
  return [...currencies].sort((first, second) => {
    const firstPosition = featuredCurrencyOrder.indexOf(first.code);
    const secondPosition = featuredCurrencyOrder.indexOf(second.code);
    const firstRank =
      firstPosition === -1 ? Number.MAX_SAFE_INTEGER : firstPosition;
    const secondRank =
      secondPosition === -1 ? Number.MAX_SAFE_INTEGER : secondPosition;

    if (firstRank !== secondRank) return firstRank - secondRank;

    return (first.display_order ?? 0) - (second.display_order ?? 0);
  });
}

function CurrencyDepositSection({ onSubmitted }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currencies = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getDepositOverview(user.id),
    queryKey: depositOverviewQueryKey(user?.id),
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });
  const accessRequest = useMutation({
    mutationFn: requestCurrencyAccess,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: depositOverviewQueryKey(user?.id),
      }),
  });

  return (
    <section className="mt-8" aria-labelledby="currency-deposits-heading">
      <div className="mb-4">
        <h2
          className="text-title-3-medium sm:text-title-2-medium"
          id="currency-deposits-heading"
        >
          Currency deposits
        </h2>
        <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
          Deposit into an enabled fiat currency balance.
        </p>
      </div>

      {currencies.error ? (
        <p className="text-body-medium text-[var(--color-text-error-primary)]">
          {currencies.error.message || "Unable to load your currency balances."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {currencies.isPending
            ? Array.from({ length: 6 }, (_, index) => (
                <CurrencyCardSkeleton key={index} />
              ))
            : orderCurrencies(
                currencies.data.filter(
                  (currency) =>
                    currency.currency_kind === "fiat" &&
                    currency.code !== "USD",
                ),
              ).map((currency) => (
                <LayerCard
                  className="w-full !bg-[var(--color-background-primary-default)] text-[var(--color-text-primary)] ring-[var(--color-separator-border)]"
                  key={currency.code}
                >
                  <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 text-[var(--color-text-secondary)]">
                    <span className="text-body-medium">{currency.code}</span>
                    {!currency.isEnabled && (
                      <Badge
                        className={
                          currency.request?.status === "rejected"
                            ? "bg-[var(--color-background-tertiary-error)] text-[var(--color-text-error-primary)]"
                            : undefined
                        }
                        color="neutral"
                      >
                        {currency.request?.status === "pending"
                          ? "Pending"
                          : currency.request?.status === "rejected"
                            ? "Rejected"
                            : "Not enabled"}
                      </Badge>
                    )}
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
                        <DepositInstructionsDialog
                          currency={currency}
                          onSubmitted={onSubmitted}
                        />
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
  );
}

export default CurrencyDepositSection;
