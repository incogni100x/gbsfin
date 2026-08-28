import { Drawer } from "@base-ui/react/drawer";
import { Tabs } from "@base-ui/react/tabs";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BankIcon,
  DashboardSquare01Icon,
  MoneyReceive01Icon,
  MoneySend01Icon,
  PiggyBankIcon,
  TransactionHistoryIcon,
} from "@hugeicons/core-free-icons";
import { forwardRef } from "react";
import { Link, Outlet, useHref, useLinkClickHandler, useLocation } from "react-router";
import DashboardHeaderActions from "./DashboardHeaderActions.jsx";
import MobileNavigationDrawer from "./MobileNavigationDrawer.jsx";
import NotificationPopover from "./NotificationPopover.jsx";

const dashboardTabs = [
  {
    icon: DashboardSquare01Icon,
    label: "Overview",
    path: "/dashboard",
    value: "overview",
  },
  {
    icon: MoneyReceive01Icon,
    label: "Deposit",
    path: "/deposit",
    value: "deposit",
  },
  {
    icon: MoneySend01Icon,
    label: "Transfer",
    path: "/transfer",
    value: "transfer",
  },
  {
    icon: PiggyBankIcon,
    label: "Fixed deposit",
    path: "/fixed-deposit",
    value: "fixed-deposit",
  },
  { icon: BankIcon, label: "Loans", path: "/loans", value: "loans" },
  {
    icon: TransactionHistoryIcon,
    label: "Transaction history",
    path: "/transaction-history",
    value: "transaction-history",
  },
];

const RouterTabLink = forwardRef(function RouterTabLink(
  { onClick, to, ...props },
  forwardedRef,
) {
  const href = useHref(to);
  const handleLinkClick = useLinkClickHandler(to);

  const handleClick = (event) => {
    onClick?.(event);

    if (!event.defaultPrevented) {
      handleLinkClick(event);
    }
  };

  return <a {...props} href={href} onClick={handleClick} ref={forwardedRef} />;
});

function DashboardLayout() {
  const location = useLocation();
  const activeTab = dashboardTabs.find(
    (tab) => tab.path === location.pathname,
  )?.value;

  return (
    <Drawer.Provider>
      <div className="relative min-h-svh overflow-hidden bg-[color-mix(in_srgb,var(--color-blue-50)_20%,var(--color-background-full))]">
        <Drawer.IndentBackground className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-blue-50)_20%,var(--color-background-full))]" />
        <Drawer.Indent className="relative z-10 min-h-svh origin-top bg-[var(--color-background-full)] transition-[transform,border-radius] duration-200 data-[active]:scale-[0.96] data-[active]:rounded-3xl motion-reduce:transition-none">
          <main className="min-h-svh bg-[color-mix(in_srgb,var(--color-blue-50)_20%,var(--color-background-full))] text-[var(--color-text-primary)]">
            <div className="bg-[color-mix(in_srgb,var(--color-blue-50)_20%,var(--color-background-full))]">
              <header className="mx-auto flex min-h-16 w-[calc(100%-3rem)] max-w-[1200px] items-center justify-between sm:min-h-[76px] max-sm:w-[calc(100%-2rem)]">
                <Link className="text-title-2-semibold flex items-center gap-2 text-[var(--color-text-primary)] no-underline" to="/dashboard">
                  <img
                    alt=""
                    className="size-8"
                    src="/logo.svg"
                  />
                  Global Stripe Fin
                </Link>
                <div className="flex items-center gap-1 sm:hidden">
                  <NotificationPopover iconOnly />
                  <MobileNavigationDrawer
                    navigationItems={dashboardTabs}
                  />
                </div>
                <div className="hidden sm:block">
                  <DashboardHeaderActions />
                </div>
              </header>
            </div>

            <Tabs.Root
              className="hidden w-full bg-[color-mix(in_srgb,var(--color-blue-50)_20%,var(--color-background-full))] sm:block"
              value={activeTab ?? null}
            >
              <div className="bg-[var(--color-accent-600)]">
                <Tabs.List
                  aria-label="Dashboard sections"
                  className="relative mx-auto flex w-[calc(100%-3rem)] max-w-[1200px] gap-7 overflow-x-auto border-b border-[var(--color-accent-500)]"
                >
                  {dashboardTabs.map((tab) => (
                    <Tabs.Tab
                      key={tab.value}
                      className={({ active }) =>
                        `text-headline-medium flex cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-3.5 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus-ring)] focus-visible:outline-offset-3 ${
                          active
                            ? "rounded-t-md bg-[var(--color-accent-800)] text-[var(--color-text-white)]"
                            : "text-[var(--color-accent-100)] hover:text-[var(--color-text-white)]"
                        }`
                      }
                      nativeButton={false}
                      render={<RouterTabLink to={tab.path} />}
                      value={tab.value}
                    >
                      <HugeiconsIcon
                        aria-hidden="true"
                        icon={tab.icon}
                        size={18}
                        strokeWidth={1.75}
                      />
                      {tab.label}
                    </Tabs.Tab>
                  ))}
                  {activeTab && (
                    <Tabs.Indicator className="absolute bottom-0 left-[var(--active-tab-left)] h-1 w-[var(--active-tab-width)] rounded-t-sm bg-[var(--color-accent-100)] transition-[left,width] duration-200 ease-out" />
                  )}
                </Tabs.List>
              </div>

            </Tabs.Root>

            <div className="w-full bg-[color-mix(in_srgb,var(--color-blue-50)_20%,var(--color-background-full))]">
              <div className="mx-auto w-[calc(100%-2rem)] max-w-[1200px] py-4 sm:w-[calc(100%-3rem)] sm:px-6 sm:py-8">
                <Outlet />
              </div>
            </div>
          </main>
        </Drawer.Indent>
      </div>
    </Drawer.Provider>
  );
}

export default DashboardLayout;
