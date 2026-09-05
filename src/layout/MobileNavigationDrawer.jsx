import { Drawer } from "@base-ui/react/drawer";
import { signOut } from "@/auth/authService.js";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CustomerSupportIcon,
  Logout01Icon,
  Menu02Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router";

function MobileNavigationDrawer({ navigationItems }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <Drawer.Root onOpenChange={setOpen} open={open}>
      <Drawer.Trigger
        aria-label="Open navigation"
        className="grid size-10 place-items-center rounded-md bg-transparent text-[var(--color-text-primary)]"
      >
        <HugeiconsIcon aria-hidden="true" icon={Menu02Icon} size={22} />
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--color-background-full)_70%,transparent)] opacity-100 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Drawer.Viewport className="fixed inset-0 z-50 flex items-end">
          <Drawer.Popup className="w-full rounded-t-3xl bg-[var(--color-background-full)] shadow-2xl outline-none transition-transform duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full data-[swiping]:translate-y-[var(--drawer-swipe-movement-y)] data-[swiping]:transition-none motion-reduce:transition-none">
            <Drawer.Content className="flex flex-col p-7 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
              <Drawer.Title className="sr-only">Navigation</Drawer.Title>
              <span
                aria-hidden="true"
                className="mx-auto h-1 w-10 rounded-full bg-[var(--color-background-quaternary-default)]"
              />

              <nav aria-label="Mobile dashboard navigation" className="mt-7 grid gap-1">
                {navigationItems.map((item) => (
                  <NavLink
                    key={item.value}
                    className={({ isActive }) =>
                      `text-headline-medium flex items-center gap-3 rounded-md px-3 py-3 no-underline ${
                        isActive
                          ? "bg-[var(--color-background-secondary-default)] text-[var(--color-accent-600)]"
                          : "text-[var(--color-text-secondary)]"
                      }`
                    }
                    onClick={() => setOpen(false)}
                    to={item.path}
                  >
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={item.icon}
                      size={20}
                      strokeWidth={1.75}
                    />
                    {item.label}
                  </NavLink>
                ))}
                <div className="my-2 h-px bg-[var(--color-separator-border)]" />
                <NavLink
                  className="text-headline-medium flex items-center gap-3 rounded-md px-3 py-3 text-[var(--color-text-secondary)] no-underline"
                  onClick={() => setOpen(false)}
                  to="/contact"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={CustomerSupportIcon}
                    size={20}
                    strokeWidth={1.75}
                  />
                  Help and support
                </NavLink>
                <NavLink
                  className={({ isActive }) =>
                    `text-headline-medium flex items-center gap-3 rounded-md px-3 py-3 no-underline ${
                      isActive
                        ? "bg-[var(--color-background-secondary-default)] text-[var(--color-accent-600)]"
                        : "text-[var(--color-text-secondary)]"
                    }`
                  }
                  onClick={() => setOpen(false)}
                  to="/profile"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={UserCircleIcon}
                    size={20}
                    strokeWidth={1.75}
                  />
                  Profile
                </NavLink>
                <button
                  className="text-headline-medium flex items-center gap-3 rounded-md px-3 py-3 text-[var(--color-text-secondary)]"
                  onClick={handleSignOut}
                  type="button"
                >
                  <HugeiconsIcon
                    aria-hidden="true"
                    icon={Logout01Icon}
                    size={20}
                    strokeWidth={1.75}
                  />
                  Sign out
                </button>
              </nav>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export default MobileNavigationDrawer;
