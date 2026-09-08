function LegalDocumentPage({ eyebrow, title, introduction, sections }) {
  return (
    <section className="mx-auto w-full max-w-[880px] px-4 py-12 sm:px-6 sm:py-20">
      <header className="max-w-3xl">
        <p className="text-body-medium text-[var(--color-accent-600)]">{eyebrow}</p>
        <h1 className="text-display-4-medium mt-3 text-balance sm:text-display-3-medium">{title}</h1>
        <p className="text-body-medium mt-4 text-[var(--color-text-secondary)]">Effective September 8, 2026</p>
        <p className="text-headline-regular mt-6 max-w-3xl text-pretty text-[var(--color-text-secondary)]">{introduction}</p>
      </header>
      <div className="mt-10 grid gap-9 border-t border-[var(--color-separator-border)] pt-10 sm:mt-12 sm:gap-10 sm:pt-12">
        {sections.map((section) => (
          <section aria-labelledby={section.id} key={section.id}>
            <h2 className="text-title-3-medium text-balance" id={section.id}>{section.title}</h2>
            <div className="text-body-regular mt-3 grid gap-3 text-pretty text-[var(--color-text-secondary)]">
              {section.content.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          </section>
        ))}
      </div>
      <p className="text-body-medium mt-12 border-t border-[var(--color-separator-border)] pt-8 text-[var(--color-text-secondary)]">
        Questions? Email{" "}
        <a className="text-[var(--color-text-primary)] underline underline-offset-4" href="mailto:support@globalstripefin.com">support@globalstripefin.com</a>.
      </p>
    </section>
  );
}

export default LegalDocumentPage;
