import { useEffect } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import MarketingFooter from "@/components/marketing/MarketingFooter.jsx";
import MobileMarketingMenu from "./MobileMarketingMenu.jsx";

const navigationItems = [
  { label: "Features", to: "/#features" },
  { label: "FAQ", to: "/#faq" },
  { label: "Testimonials", to: "/#testimonials" },
  { label: "Contact", to: "/contact" },
];

function ScrollToMarketingHash() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;

    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
  }, [hash]);

  return null;
}

function MarketingLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-[var(--color-background-full)] text-[var(--color-text-primary)]">
      <ScrollToMarketingHash />
      <header className="bg-[var(--color-background-primary-default)]">
        <div className="mx-auto flex min-h-16 w-[calc(100%-2rem)] max-w-[1200px] items-center justify-between gap-6 sm:w-[calc(100%-3rem)]">
          <Link
            className="text-title-3-semibold flex shrink-0 items-center gap-2 no-underline"
            to="/"
          >
            <img alt="" className="size-8" src="/logo.svg" />
            Global Stripe Fin
          </Link>

          <nav aria-label="Marketing navigation" className="hidden items-center gap-6 md:flex">
            {navigationItems.map((item) => (
              item.to.includes("#") ? (
                <Link
                  className="text-body-medium text-[var(--color-text-secondary)] no-underline transition-colors duration-150 hover:text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-border-focus-ring)] motion-reduce:transition-none"
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </Link>
              ) : (
                <NavLink
                  className={({ isActive }) =>
                    `text-body-medium no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-border-focus-ring)] motion-reduce:transition-none ${
                      isActive
                        ? "text-[var(--color-accent-600)]"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`
                  }
                  key={item.to}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              )
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              className="text-body-medium inline-flex h-9 items-center justify-center rounded-2lg border border-border-button-default bg-background-primary-default px-3 text-text-primary no-underline shadow-xs transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out hover:border-border-button-hover hover:bg-background-primary-hover active:scale-[0.98] active:border-border-button-active active:bg-background-primary-active focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus-ring motion-reduce:transition-none"
              to="/login"
            >
              Sign in
            </Link>
            <Link
              className="text-body-medium inline-flex h-9 items-center justify-center rounded-2lg bg-button-primary px-3 text-text-white no-underline shadow-xs transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-[var(--color-accent-700)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus-ring motion-reduce:transition-none"
              to="/register"
            >
              Open an account
            </Link>
          </div>
          <div className="md:hidden">
            <MobileMarketingMenu navigationItems={navigationItems} />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
}

export default MarketingLayout;
