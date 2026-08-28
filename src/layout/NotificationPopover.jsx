import { Button, Popover } from "@cloudflare/kumo";
import { Notification02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

function NotificationPopover({ iconOnly = false }) {
  return (
    <Popover>
      <Popover.Trigger
        render={
          <Button
            aria-label="Notifications"
            className={`text-body-medium flex items-center rounded-md bg-transparent text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent-600)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus-ring)] focus-visible:outline-offset-2 ${
              iconOnly ? "size-10 justify-center p-0" : "gap-2 px-2.5 py-2"
            }`}
            variant="ghost"
          >
            <HugeiconsIcon
              aria-hidden="true"
              icon={Notification02Icon}
              size={20}
              strokeWidth={1.75}
            />
            {!iconOnly && "Notifications"}
          </Button>
        }
      />
      <Popover.Content
        align="end"
        className="notification-popover w-80"
        positionMethod="fixed"
      >
        <Popover.Title>Notifications</Popover.Title>
        <Popover.Description className="mt-2">
          You are all caught up. Good job!
        </Popover.Description>
      </Popover.Content>
    </Popover>
  );
}

export default NotificationPopover;
