function PageHeader({ description, eyebrow, title }) {
  return (
    <header className="mb-6 grid gap-1">
      {eyebrow ? (
        <span className="text-body-2-medium tracking-wide text-[var(--color-accent-600)] uppercase">
          {eyebrow}
        </span>
      ) : null}
      <h1 className="text-title-2-medium text-[var(--color-text-primary)] sm:text-title-1-medium">
        {title}
      </h1>
      {description ? (
        <p className="text-body-medium max-w-2xl text-[var(--color-text-secondary)]">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export default PageHeader;
