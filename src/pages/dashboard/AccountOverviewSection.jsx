import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Wallet02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import AccountCardSkeleton from "./AccountCardSkeleton.jsx";
import {
  formatAccountLabel,
  formatBalance,
} from "./dashboardFormatters.js";

function AccountOverviewSection({ accounts, error, isPending }) {
  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <AccountCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-body-medium text-[var(--color-text-error-primary)]">
        {error.message || "Unable to load your accounts."}
      </p>
    );
  }

  if (accounts.length === 0) {
    return (
      <p className="text-body-medium text-[var(--color-text-secondary)]">
        No accounts are available yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <LayerCard
          className="w-full !bg-[var(--color-background-primary-default)] text-[var(--color-text-primary)] ring-[var(--color-separator-border)]"
          key={account.id}
        >
          <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 text-[var(--color-text-secondary)] md:p-4">
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

          <LayerCard.Primary className="!bg-[var(--color-accent-600)] px-4 py-3 text-[var(--color-neutral-50)] ring-[var(--color-separator-border)] md:p-4">
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
  );
}

export default AccountOverviewSection;
