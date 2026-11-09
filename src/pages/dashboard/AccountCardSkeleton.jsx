import { LayerCard } from "@cloudflare/kumo/components/layer-card";

function AccountCardSkeleton() {
  return (
    <LayerCard
      aria-busy="true"
      className="w-full !bg-[var(--color-background-primary-default)] ring-[var(--color-separator-border)]"
    >
      <span className="sr-only">Loading your accounts</span>
      <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 md:p-4">
        <span className="size-5 animate-pulse rounded bg-[var(--color-background-tertiary-default)] motion-reduce:animate-none" />
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <span className="block h-5 w-28 animate-pulse rounded bg-[var(--color-background-tertiary-default)] motion-reduce:animate-none" />
          <span className="block h-6 w-40 max-w-full animate-pulse rounded bg-[var(--color-background-tertiary-default)] motion-reduce:animate-none" />
        </div>
      </LayerCard.Secondary>

      <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-3 ring-[var(--color-separator-border)] md:p-4">
        <span className="h-4 w-24 animate-pulse rounded bg-[var(--color-background-tertiary-default)] motion-reduce:animate-none" />
        <span className="mt-2 h-8 w-40 animate-pulse rounded bg-[var(--color-background-tertiary-default)] motion-reduce:animate-none" />
      </LayerCard.Primary>
    </LayerCard>
  );
}

export default AccountCardSkeleton;
