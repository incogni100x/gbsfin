import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { cx } from "@/utils/cx";

function Accordion({ className, ...props }) {
  return (
    <AccordionPrimitive.Root
      className={cx("grid", className)}
      data-slot="accordion"
      {...props}
    />
  );
}

function AccordionItem({ className, ...props }) {
  return (
    <AccordionPrimitive.Item
      className={cx("border-b border-[var(--color-separator-border)]", className)}
      data-slot="accordion-item"
      {...props}
    />
  );
}

function AccordionTrigger({ children, className, ...props }) {
  return (
    <AccordionPrimitive.Header data-slot="accordion-header">
      <AccordionPrimitive.Trigger
        className={cx(
          "group flex min-h-12 w-full items-center justify-between gap-4 py-4 text-left text-headline-medium text-[var(--color-text-primary)] outline-none transition-colors duration-150 hover:text-[var(--color-accent-600)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus-ring)]",
          className,
        )}
        data-slot="accordion-trigger"
        {...props}
      >
        {children}
        <HugeiconsIcon
          aria-hidden="true"
          className="shrink-0 text-[var(--color-text-secondary)] transition-transform duration-200 group-data-[open]:rotate-180 motion-reduce:transition-none"
          icon={ArrowDown01Icon}
          size={20}
          strokeWidth={1.75}
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ children, className, ...props }) {
  return (
    <AccordionPrimitive.Panel
      className={cx(
        "overflow-hidden pb-4 text-body-medium text-[var(--color-text-secondary)]",
        className,
      )}
      data-slot="accordion-content"
      {...props}
    >
      {children}
    </AccordionPrimitive.Panel>
  );
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
