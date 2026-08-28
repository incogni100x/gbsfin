import { LoaderIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cx } from "@/utils/cx";

function Spinner({ className, ...props }: ComponentProps<typeof LoaderIcon>) {
  return (
    <LoaderIcon
      aria-label="Loading"
      className={cx("size-4 animate-spin", className)}
      role="status"
      {...props}
    />
  );
}

export { Spinner };
