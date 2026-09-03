import { Button } from "@/components/base/buttons/button";
import { DialogTitle } from "@/components/ui/dialog";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

export default function TransferConfirmation({
  description,
  details,
  note,
  onDone,
  summary,
  summaryTitle,
  title,
}) {
  return (
    <div className="py-2 text-center" role="status">
      <HugeiconsIcon
        aria-hidden="true"
        className="mx-auto text-[var(--color-accent-600)]"
        icon={CheckmarkCircle02Icon}
        size={40}
        strokeWidth={1.75}
      />
      <DialogTitle className="mt-4">{title}</DialogTitle>
      <p className="text-body-medium mt-2 text-pretty text-[var(--color-text-secondary)]">
        {description}
      </p>

      <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-secondary-default)] p-4 text-left">
        <strong className="text-headline-medium">{summaryTitle}</strong>
        <p className="text-body-medium mt-2 text-[var(--color-text-secondary)]">
          {summary}
        </p>
      </div>

      <dl className="financial-number mt-4 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-secondary-default)] p-4 text-left">
        {details.map((detail, index) => (
          <div
            className={`flex items-start justify-between gap-4 ${index ? "border-t border-[var(--color-separator-border)] pt-3" : ""}`}
            key={detail.label}
          >
            <dt className="text-body-medium text-[var(--color-text-secondary)]">
              {detail.label}
            </dt>
            <dd
              className={`text-body-medium max-w-[60%] break-words text-right ${detail.emphasis ? "text-headline-medium tabular-nums" : ""} ${detail.mono ? "font-mono select-all" : ""}`}
            >
              {detail.value}
            </dd>
          </div>
        ))}
      </dl>

      {note && (
        <p className="text-body-2-medium mt-4 text-[var(--color-text-secondary)]">
          {note}
        </p>
      )}
      <Button className="mt-5" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
