import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

function SuccessState({ action, description, title }) {
  return (
    <section className="grid justify-items-center gap-4 py-8 text-center" role="status">
      <span className="grid size-14 place-items-center rounded-full bg-[var(--color-state-success-base)] text-[var(--color-state-success-text)]">
        <HugeiconsIcon
          aria-hidden="true"
          icon={CheckmarkCircle02Icon}
          size={28}
          strokeWidth={1.8}
        />
      </span>
      <div className="grid max-w-md gap-2">
        <h1 className="text-title-1-medium text-[var(--color-text-primary)]">
          {title}
        </h1>
        <p className="text-body-medium text-[var(--color-text-secondary)]">
          {description}
        </p>
      </div>
      <div className="mt-2">{action}</div>
    </section>
  );
}

export default SuccessState;
