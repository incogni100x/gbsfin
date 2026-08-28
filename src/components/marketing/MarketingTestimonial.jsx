function MarketingTestimonial() {
  return (
    <section
      className="relative isolate overflow-hidden bg-[var(--color-background-primary-default)] px-4 py-16 sm:px-6 sm:py-24"
      id="testimonials"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,var(--color-accent-100),white)] opacity-30"
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-1/2 -z-10 mr-16 w-[200%] origin-bottom-left skew-x-[-30deg] bg-[var(--color-background-primary-default)] shadow-xl shadow-[color-mix(in_srgb,var(--color-accent-600)_10%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--color-accent-100)_65%,transparent)] sm:mr-28 lg:mr-0 xl:mr-16 xl:origin-center"
      />
      <div className="mx-auto max-w-2xl lg:max-w-4xl">
        <h2 className="sr-only">Customer testimonial</h2>
        <img alt="Whitmore & Co." className="mx-auto h-12 w-auto" src="/logoco.svg" />
        <figure className="mt-10">
          <blockquote className="text-display-4-medium text-center text-balance text-[var(--color-text-primary)] sm:text-display-3-medium">
            <p>
              “Global Stripe Fin makes sending and converting money across
              currencies feel straightforward. I can see the details before I
              move funds and manage everything from one place.”
            </p>
          </blockquote>
          <figcaption className="mt-10">
            <img
              alt="Customer portrait"
              className="mx-auto size-10 rounded-full object-cover"
              loading="lazy"
              src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
            />
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-body-medium">
              <span className="text-headline-medium text-[var(--color-text-primary)]">
                Eleanor Whitmore
              </span>
              <span aria-hidden="true" className="size-1 rounded-full bg-[var(--color-text-secondary)]" />
              <span className="text-[var(--color-text-secondary)]">
                Managing Director, Whitmore &amp; Co.
              </span>
            </div>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

export default MarketingTestimonial;
