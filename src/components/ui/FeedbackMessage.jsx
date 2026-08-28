import { Alert02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const toneClasses = {
  error: "text-[var(--color-text-error-primary)]",
  success: "text-[var(--color-state-success-text)]",
};

function FeedbackMessage({ children, tone = "success" }) {
  if (!children) return null;

  return (
    <p
      aria-live="polite"
      className={`text-body-2-medium ${
        tone === "error" ? "flex items-start gap-2" : ""
      } ${toneClasses[tone]}`}
      role={tone === "error" ? "alert" : "status"}
    >
      {tone === "error" ? (
        <HugeiconsIcon
          aria-hidden="true"
          className="mt-0.5 shrink-0"
          icon={Alert02Icon}
          size={16}
          strokeWidth={1.8}
        />
      ) : null}
      {children}
    </p>
  );
}

export default FeedbackMessage;
