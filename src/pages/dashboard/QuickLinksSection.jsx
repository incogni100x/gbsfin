import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "react-router";

const quickLinks = [
  { label: "Manage accounts", to: "/manage-accounts" },
  {
    label: "Add another currency",
    to: "/deposit?show=available#currency-balances",
  },
];

function QuickLinksSection() {
  return (
    <section aria-labelledby="quick-links-heading" className="mt-6">
      <h2
        className="text-title-3-medium sm:text-title-2-medium"
        id="quick-links-heading"
      >
        Quick links
      </h2>
      <div className="mt-3 flex flex-wrap gap-3">
        {quickLinks.map((quickLink) => (
          <Link
            className="text-body-medium inline-flex min-h-9 items-center gap-2 rounded-2lg bg-[var(--color-accent-600)] px-3 text-white no-underline transition-colors hover:bg-[var(--color-accent-500)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus-ring)]"
            key={quickLink.to}
            to={quickLink.to}
          >
            {quickLink.label}
            <HugeiconsIcon
              aria-hidden="true"
              icon={ArrowRight01Icon}
              size={16}
              strokeWidth={1.75}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default QuickLinksSection;
