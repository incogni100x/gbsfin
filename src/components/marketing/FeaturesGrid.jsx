import { HugeiconsIcon } from "@hugeicons/react";
import {
  BankIcon,
  BitcoinTransactionIcon,
  Exchange01Icon,
  MoneyReceive01Icon,
  MoneySend01Icon,
  PiggyBankIcon,
} from "@hugeicons/core-free-icons";

const features = [
  {
    description:
      "Send and receive global currencies, then convert directly to your preferred local payout.",
    icon: MoneySend01Icon,
    title: "Global money transfers",
  },
  {
    description:
      "Move between eligible currencies with current conversion rates shown before you confirm.",
    icon: Exchange01Icon,
    title: "Currency exchange",
  },
  {
    description:
      "Transfer and convert USDT and USDC alongside your other supported currency balances.",
    icon: BitcoinTransactionIcon,
    title: "Stablecoin ready",
  },
  {
    description:
      "Manage your currency balances and everyday bank accounts together in one secure dashboard.",
    icon: MoneyReceive01Icon,
    title: "Multi-currency accounts",
  },
  {
    description:
      "Explore competitive loans and flexible financing options tailored to your financial goals.",
    icon: BankIcon,
    title: "Loans and financing",
  },
  {
    description:
      "Grow eligible funds with fixed deposits, clear expected returns, and flexible term options.",
    icon: PiggyBankIcon,
    title: "Fixed deposits",
  },
];

function FeaturesGrid() {
  return (
    <section
      aria-labelledby="features-heading"
      className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24"
      id="features"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          className="text-display-4-medium text-balance sm:text-display-3-medium"
          id="features-heading"
        >
          Financial services that move with you.
        </h2>
        <p className="text-headline-regular mt-4 text-[var(--color-text-secondary)] text-pretty">
          Global Stripe Fin brings international transfers, currency exchange,
          stablecoins, financing, and fixed deposits into one place.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 space-y-0.5 rounded-2xl bg-background-secondary-default p-0.5 shadow-sm sm:grid-cols-2 sm:gap-0.5 sm:space-y-0 lg:grid-cols-3">
        {features.map((feature) => (
          <article
            className="relative min-h-0 rounded-xl bg-background-primary-default p-5 shadow-none sm:min-h-60 sm:p-6"
            key={feature.title}
          >
            <span className="inline-flex p-3 text-[var(--color-accent-600)]">
              <HugeiconsIcon
                aria-hidden="true"
                icon={feature.icon}
                size={24}
                strokeWidth={1.75}
              />
            </span>
            <div className="mt-5">
              <h3 className="text-title-3-semibold text-balance">
                {feature.title}
              </h3>
              <p className="text-body-regular mt-2 text-[var(--color-text-secondary)] text-pretty">
                {feature.description}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default FeaturesGrid;
