import { Button, Popover } from "@cloudflare/kumo";
import { Notification02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAuth } from "@/auth/useAuth.js";
import { requireSupabase } from "@/lib/supabase/client.js";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function NotificationPopover({ iconOnly = false }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useQuery({
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from("notifications")
        .select("id, title, message, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
    queryKey: ["notifications", user?.id],
  });
  const unread = notifications.filter((notification) => !notification.is_read).length;
  const markRead = async () => {
    const unreadIds = notifications.filter((notification) => !notification.is_read).map((notification) => notification.id);
    if (!unreadIds.length) return;
    const { error } = await requireSupabase().from("notifications").update({ is_read: true }).in("id", unreadIds);
    if (!error) queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
  };
  return (
    <Popover>
      <Popover.Trigger
        render={
          <Button
            aria-label="Notifications"
            onClick={markRead}
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
            {unread ? <span aria-label={`${unread} unread notifications`} className="size-2 rounded-full bg-[var(--color-accent-500)]" /> : null}
          </Button>
        }
      />
      <Popover.Content
        align="end"
        className="notification-popover w-80"
        positionMethod="fixed"
      >
        <Popover.Title>Notifications</Popover.Title>
        <div className="mt-3 grid gap-3">
          {notifications.length ? notifications.map((notification) => <article className="border-b border-[var(--color-separator-border)] pb-3 last:border-0 last:pb-0" key={notification.id}><p className="text-body-medium text-[var(--color-text-primary)]">{notification.title}</p><p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">{notification.message}</p></article>) : <Popover.Description>You are all caught up. Good job!</Popover.Description>}
        </div>
      </Popover.Content>
    </Popover>
  );
}

export default NotificationPopover;
