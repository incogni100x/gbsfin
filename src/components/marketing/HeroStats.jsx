const stats = [
  {
    label: "Transfers processed",
    value: "100K+",
    detail: "Global transactions",
  },
  {
    label: "Platform uptime",
    value: "99.9%",
    detail: "Reliable access",
  },
  {
    label: "Supported currencies",
    value: "8+",
    detail: "Global and stablecoin balances",
  },
  {
    label: "Customer support",
    value: "24/7",
    detail: "Here when you need us",
  },
];

function HeroStats() {
  return (
    <section
      aria-labelledby="stats-heading"
      className="mx-auto mt-0 w-full max-w-[1200px] px-4 pb-16 sm:px-6 sm:pb-24"
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2
          className="text-display-4-medium text-balance sm:text-display-3-medium"
          id="stats-heading"
        >
          Built for dependable global banking.
        </h2>
        <p className="text-headline-regular mt-4 text-[var(--color-text-secondary)] text-pretty">
          Every account is designed to make moving, managing, and growing your
          money feel simple.
        </p>
      </div>
      <div className="mx-auto mt-10 grid grid-cols-1 gap-px rounded-xl bg-[var(--color-separator-border)] sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <article
            className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 bg-[var(--color-background-primary-default)] p-4 text-left sm:p-6 ${
              index === 0 ? "rounded-l-xl" : ""
            } ${index === stats.length - 1 ? "rounded-r-xl" : ""}`}
            key={stat.label}
          >
            <span className="text-body-medium text-[var(--color-text-secondary)]">
              {stat.label}
            </span>
            <span className="text-body-2-medium text-[var(--color-text-secondary)]">
              {stat.detail}
            </span>
            <strong className="financial-number w-full flex-none text-3xl font-medium tracking-tight">
              {stat.value}
            </strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HeroStats;
