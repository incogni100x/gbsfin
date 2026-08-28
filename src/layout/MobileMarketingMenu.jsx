import { Drawer } from "@base-ui/react/drawer";
import { Menu02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Link, NavLink } from "react-router";

const actionBase =
  "text-body-medium inline-flex h-10 items-center justify-center rounded-2lg px-3 no-underline transition-[transform,background-color,border-color,box-shadow] duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus-ring motion-reduce:transition-none";

function MobileMarketingMenu({ navigationItems }) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer.Root onOpenChange={setOpen} open={open}>
      <Drawer.Trigger
        aria-label="Open marketing navigation"
        className="grid size-10 place-items-center rounded-lg text-[var(--color-text-primary)] transition-colors duration-150 hover:bg-[var(--color-background-primary-hover)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus-ring)] motion-reduce:transition-none"
      >
        <HugeiconsIcon aria-hidden="true" icon={Menu02Icon} size={22} />
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--color-text-primary)_28%,transparent)] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end">
          <Drawer.Popup className="w-full rounded-t-3xl bg-[var(--color-background-primary-default)] shadow-2xl outline-none transition-transform duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none">
            <Drawer.Content className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <Drawer.Title className="sr-only">Marketing navigation</Drawer.Title>
              <span
                aria-hidden="true"
                className="mx-auto block h-1 w-10 rounded-full bg-[var(--color-background-quaternary-default)]"
              />
              <nav aria-label="Marketing navigation" className="mt-6 grid gap-1">
                {navigationItems.map((item) =>
                  item.to.includes("#") ? (
                    <Link
                      className="text-headline-medium rounded-lg px-3 py-3 text-[var(--color-text-secondary)] no-underline"
                      key={item.to}
                      onClick={() => setOpen(false)}
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <NavLink
                      className={({ isActive }) =>
                        `text-headline-medium rounded-lg px-3 py-3 no-underline ${
                          isActive
                            ? "bg-[var(--color-background-secondary-default)] text-[var(--color-accent-600)]"
                            : "text-[var(--color-text-secondary)]"
                        }`
                      }
                      key={item.to}
                      onClick={() => setOpen(false)}
                      to={item.to}
                    >
                      {item.label}
                    </NavLink>
                  ),
                )}
              </nav>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--color-separator-border)] pt-5">
                <Link
                  className={`${actionBase} border border-border-button-default bg-background-primary-default text-text-primary shadow-xs hover:border-border-button-hover hover:bg-background-primary-hover`}
                  onClick={() => setOpen(false)}
                  to="/login"
                >
                  Sign in
                </Link>
                <Link
                  className={`${actionBase} bg-button-primary text-text-white shadow-xs hover:bg-[var(--color-accent-700)]`}
                  onClick={() => setOpen(false)}
                  to="/register"
                >
                  Open an account
                </Link>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export default MobileMarketingMenu;
