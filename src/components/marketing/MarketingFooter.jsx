import { Link } from "react-router";

const footerGroups = [
  {
    links: [
      { label: "Features", to: "/#features" },
      { label: "FAQ", to: "/#faq" },
      { label: "Testimonials", to: "/#testimonials" },
      { label: "Contact", to: "/contact" },
    ],
    title: "Explore",
  },
  {
    links: [
      { label: "Sign in", to: "/login" },
      { label: "Open an account", to: "/register" },
    ],
    title: "Account",
  },
  {
    links: [{ label: "Legal", to: "/legal" }],
    title: "Legal",
  },
];

function MarketingFooter() {
  return (
    <footer className="bg-[var(--color-background-primary-default)] px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-[1200px]">
        <div className="md:flex md:justify-between md:gap-12">
          <div className="mb-8 md:mb-0">
            <Link
              className="text-title-3-semibold inline-flex items-center gap-2 text-[var(--color-text-primary)] no-underline"
              to="/"
            >
              <img alt="" className="size-8" src="/logo.svg" />
              Global Stripe Fin
            </Link>
            <p className="text-body-medium mt-3 max-w-xs text-[var(--color-text-secondary)]">
              Global banking for moving, managing, and growing your money.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-10">
            {footerGroups.map((group) => (
              <div key={group.title}>
                <h2 className="text-body-medium mb-4 text-[var(--color-text-primary)]">
                  {group.title}
                </h2>
                <ul className="grid gap-3">
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        className="text-body-medium inline-flex min-h-8 items-center text-[var(--color-text-secondary)] no-underline transition-colors duration-150 hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus-ring)] motion-reduce:transition-none"
                        to={link.to}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--color-separator-border)] pt-6 sm:mt-10 sm:flex sm:items-center sm:justify-between">
          <p className="text-body-2-medium text-[var(--color-text-secondary)]">
            © {new Date().getFullYear()} Global Stripe Fin. All rights reserved.
          </p>
          <a
            className="text-body-2-medium mt-3 inline-flex min-h-8 items-center text-[var(--color-text-secondary)] no-underline transition-colors duration-150 hover:text-[var(--color-text-primary)] sm:mt-0"
            href="mailto:support@globalstripefin.com"
          >
            support@globalstripefin.com
          </a>
        </div>
      </div>
    </footer>
  );
}

export default MarketingFooter;
