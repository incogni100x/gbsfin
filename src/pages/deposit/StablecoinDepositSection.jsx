import { useAuth } from "@/auth/useAuth.js";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useQuery } from "@tanstack/react-query";
import DepositInstructionsDialog from "./DepositInstructionsDialog.jsx";
import {
  depositOverviewQueryKey,
  getDepositOverview,
} from "./depositService.js";

function StablecoinCardSkeleton() {
  return (
    <LayerCard className="w-full !bg-[var(--color-background-primary-default)] ring-[var(--color-separator-border)]">
      <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3">
        <span className="h-5 w-16 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" />
      </LayerCard.Secondary>
      <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-4 ring-[var(--color-separator-border)]">
        <span className="h-6 w-28 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" />
        <span className="h-4 w-40 animate-pulse rounded bg-[var(--color-background-tertiary-default)]" />
      </LayerCard.Primary>
    </LayerCard>
  );
}

function StablecoinDepositSection({ accounts = [], onSubmitted }) {
  const { user } = useAuth();
  const currencies = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getDepositOverview(user.id),
    queryKey: depositOverviewQueryKey(user?.id),
    refetchInterval: 30 * 1000,
    staleTime: 15 * 1000,
  });

  const stablecoins = (currencies.data || [])
    .filter((currency) => currency.currency_kind === "stablecoin")
    .sort((first, second) => first.code.localeCompare(second.code));

  return (
    <section className="mt-8" aria-labelledby="stablecoin-deposits-heading">
      <div className="mb-4">
        <h2
          className="text-title-3-medium sm:text-title-2-medium"
          id="stablecoin-deposits-heading"
        >
          Stablecoin deposits
        </h2>
        <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
          Send USDC or USDT and credit the approved value to a selected USD bank
          account.
        </p>
      </div>

      {currencies.error ? (
        <p className="text-body-medium text-[var(--color-text-error-primary)]">
          {currencies.error.message || "Unable to load stablecoin deposits."}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {currencies.isPending
            ? Array.from({ length: 2 }, (_, index) => (
                <StablecoinCardSkeleton key={index} />
              ))
            : stablecoins.map((currency) => (
                <LayerCard
                  className="w-full !bg-[var(--color-background-primary-default)] text-[var(--color-text-primary)] ring-[var(--color-separator-border)]"
                  key={currency.code}
                >
                  <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 text-[var(--color-text-secondary)]">
                    <span className="text-body-medium">{currency.code}</span>
                  </LayerCard.Secondary>
                  <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-4 ring-[var(--color-separator-border)]">
                    <strong className="text-title-3-medium">
                      {currency.name}
                    </strong>
                    <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                      Deposited value is credited to your USD account after
                      approval.
                    </span>
                    <div className="mt-3">
                      <DepositInstructionsDialog
                        accounts={accounts}
                        currency={currency}
                        onSubmitted={onSubmitted}
                      />
                    </div>
                  </LayerCard.Primary>
                </LayerCard>
              ))}
        </div>
      )}
    </section>
  );
}

export default StablecoinDepositSection;
