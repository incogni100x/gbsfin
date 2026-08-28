import { Drawer } from "@base-ui/react/drawer";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BankIcon,
  DashboardSquare01Icon,
  MoneyReceive01Icon,
  MoneySend01Icon,
  PiggyBankIcon,
  TransactionHistoryIcon,
} from "@hugeicons/core-free-icons";
import { Tab, TabList, TabPanel, Tabs } from "@/components/base/tabs/tabs";
import { Link, Outlet, useLocation, useNavigate } from "react-router";
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

function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = dashboardTabs.find(
    (tab) => tab.path === location.pathname,
  )?.value;
  const tabSelectionProps = activeTab ? { selectedKey: activeTab } : {};

  return (
    <Drawer.Provider>
      <div className="relative min-h-svh overflow-hidden bg-[var(--color-background-full)]">
        <Drawer.IndentBackground className="absolute inset-0 bg-[var(--color-background-full)]" />
        <Drawer.Indent className="relative z-10 min-h-svh origin-top bg-[var(--color-background-full)] transition-[transform,border-radius] duration-200 data-[active]:scale-[0.96] data-[active]:rounded-3xl motion-reduce:transition-none">
          <main className="min-h-svh bg-[var(--color-background-full)] text-[var(--color-text-primary)]">
            <div className="bg-[var(--color-background-full)]">
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

            <Tabs
              aria-label="Dashboard sections"
              className="hidden w-full gap-0 bg-[var(--color-background-full)] sm:flex"
              onSelectionChange={(value) => {
                const selectedTab = dashboardTabs.find((tab) => tab.value === value);
                if (selectedTab) navigate(selectedTab.path);
              }}
              {...tabSelectionProps}
            >
              <TabList className="mx-auto w-[calc(100%-3rem)] max-w-[1200px] gap-2 overflow-x-auto max-xl:gap-1">
                {dashboardTabs.map((tab) => (
                  <Tab
                    className="[&>span:first-child]:!text-headline-medium [&>span:first-child>svg]:!size-[18px]"
                    id={tab.value}
                    key={tab.value}
                  >
                    <HugeiconsIcon
                      aria-hidden="true"
                      className="size-4 shrink-0"
                      icon={tab.icon}
                      strokeWidth={1.75}
                    />
                    <span>{tab.label}</span>
                  </Tab>
                ))}
              </TabList>
              {dashboardTabs.map((tab) => (
                <TabPanel className="hidden" id={tab.value} key={tab.value} />
              ))}
            </Tabs>

            <div className="w-full bg-[var(--color-background-full)]">
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
