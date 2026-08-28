function AuthProgress({ currentStep, labels }) {
  const stepNumber = currentStep + 1;
  const percentage = (stepNumber / labels.length) * 100;

  return (
    <div aria-label={`Step ${stepNumber} of ${labels.length}: ${labels[currentStep]}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-body-2-medium text-[var(--color-text-secondary)]">
          Step {stepNumber} of {labels.length}
        </span>
        <span className="text-body-2-medium text-[var(--color-accent-600)]">
          {labels[currentStep]}
        </span>
      </div>
      <div
        aria-hidden="true"
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-background-secondary-default)]"
      >
        <div
          className="h-full rounded-full bg-[var(--color-accent-600)] transition-[width] duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default AuthProgress;
