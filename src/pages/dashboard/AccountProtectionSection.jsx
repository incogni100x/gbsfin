import {
  BankIcon,
  ShieldCheckIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

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

function AccountProtectionSection() {
  return (
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
  );
}

export default AccountProtectionSection;
