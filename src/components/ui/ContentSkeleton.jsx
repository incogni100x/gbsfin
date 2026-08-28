function ContentSkeleton({ cards = 3, label = "Loading content" }) {
  return (
    <div aria-busy="true" aria-label={label} className="grid gap-4 md:grid-cols-3">
      {Array.from({ length: cards }, (_, index) => (
        <div
          className="h-32 animate-pulse rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] p-5 motion-reduce:animate-none"
          key={index}
        >
          <div className="h-4 w-28 rounded bg-[var(--color-background-tertiary-default)]" />
          <div className="mt-5 h-8 w-36 rounded bg-[var(--color-background-tertiary-default)]" />
          <div className="mt-3 h-4 w-24 rounded bg-[var(--color-background-tertiary-default)]" />
        </div>
      ))}
    </div>
  );
}

export default ContentSkeleton;
