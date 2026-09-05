import { Avatar } from "@/components/base/avatar/avatar";
import { signOut } from "@/auth/authService.js";
import { useAuth } from "@/auth/useAuth.js";
import { HugeiconsIcon } from "@hugeicons/react";
import { CustomerSupportIcon, Logout01Icon } from "@hugeicons/core-free-icons";
import { NavLink, useNavigate } from "react-router";
import NotificationPopover from "./NotificationPopover.jsx";

const actionClassName =
  "text-body-medium flex items-center gap-2 rounded-md bg-transparent px-2.5 py-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent-600)] active:text-[var(--color-accent-600)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus-ring)] focus-visible:outline-offset-2";

function DashboardHeaderActions() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const firstName =
    profile?.first_name || user?.user_metadata?.first_name || "Profile";
  const lastName = profile?.last_name || user?.user_metadata?.last_name || "";
  const initials = `${firstName[0] ?? "U"}${lastName[0] ?? ""}`.toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex items-center gap-2">
      <NavLink
        aria-label="Help and support"
        className={actionClassName}
        to="/contact"
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={CustomerSupportIcon}
          size={20}
          strokeWidth={1.75}
        />
        <span>Help and support</span>
      </NavLink>

      <NotificationPopover />

      <span className="mx-1 h-6 w-px bg-[var(--color-separator-border)]" />
      <NavLink
        className={({ isActive }) =>
          `text-body-medium flex items-center gap-2 rounded-md no-underline transition-colors hover:text-[var(--color-accent-600)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus-ring)] focus-visible:outline-offset-2 ${
            isActive
              ? "text-[var(--color-accent-600)]"
              : "text-[var(--color-text-secondary)]"
          }`
        }
        to="/profile"
      >
        <Avatar
          alt={`${firstName} ${lastName}`.trim()}
          color="blue"
          initials={initials}
          size="md"
        />
        <span>{firstName}</span>
      </NavLink>
      <button className={actionClassName} onClick={handleSignOut} type="button">
        <HugeiconsIcon
          aria-hidden="true"
          icon={Logout01Icon}
          size={20}
          strokeWidth={1.75}
        />
        <span>Sign out</span>
      </button>
    </div>
  );
}

export default DashboardHeaderActions;
