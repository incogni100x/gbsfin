import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cx } from "@/utils/cx";

function Dialog(props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal(props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cx(
        "fixed inset-0 z-[200] bg-black/20 data-[state=closed]:opacity-0 data-[state=open]:opacity-100 transition-opacity duration-200",
        className,
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

function DialogContent({
  children,
  className,
  showCloseButton = true,
  ...props
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cx(
          "fixed top-1/2 left-1/2 z-[200] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-6 rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] p-5 text-[var(--color-text-primary)] shadow-xl outline-none sm:max-w-md sm:p-6",
          className,
        )}
        data-slot="dialog-content"
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] opacity-70 transition-[color,opacity] duration-150 hover:text-[var(--color-accent-600)] hover:opacity-100 focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus-ring)] focus-visible:outline-offset-2"
            data-slot="dialog-close"
          >
            <XIcon aria-hidden="true" className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cx("flex flex-col gap-2 text-center sm:text-left", className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cx(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      className={cx("text-title-3-medium", className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      className={cx(
        "text-body-medium text-[var(--color-text-secondary)]",
        className,
      )}
      data-slot="dialog-description"
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
