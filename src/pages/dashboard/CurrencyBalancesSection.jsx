import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Wallet02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router";
import DepositInstructionsDialog from "../deposit/DepositInstructionsDialog.jsx";
import AccountCardSkeleton from "./AccountCardSkeleton.jsx";
import { formatBalance } from "./dashboardFormatters.js";

function CurrencyBalancesSection({
  currencies,
  error,
  isPending,
  onDepositSubmitted,
}) {
  const enabledCurrencies = currencies.filter(
    (currency) =>
      currency.isEnabled &&
      currency.currency_kind === "fiat" &&
      currency.code !== "USD",
  );

  return (
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

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <AccountCardSkeleton key={index} />
          ))}
        </div>
      ) : error ? (
        <p className="text-body-medium text-[var(--color-text-error-primary)]">
          {error.message || "Unable to load your currencies."}
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
                <div className="mt-3">
                  <DepositInstructionsDialog
                    currency={currency}
                    onSubmitted={onDepositSubmitted}
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

export default CurrencyBalancesSection;
