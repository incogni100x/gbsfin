import { Button } from "@/components/base/buttons/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

function CurrencyApplicationOverlay({ currency, onRequest, requestStatus }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const titleId = `currency-application-title-${currency.code}`;

  const closeOverlay = () => {
    setOpen(false);
    setSubmitted(false);
    setError("");
  };

  const submitRequest = async () => {
    setError("");
    setLoading(true);

    try {
      await onRequest(currency.code);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to send your request.");
    } finally {
      setLoading(false);
    }
  };

  if (requestStatus === "pending") {
    return (
      <Button disabled size="small" variant="secondary">
        Request pending
      </Button>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="small">
        Apply
      </Button>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeOverlay();
        }}
        open={open}
      >
        <DialogContent aria-describedby={undefined}>
          {!submitted ? (
            <div>
              <DialogTitle id={titleId}>
                Apply for {currency.code}
              </DialogTitle>
              <p className="text-body-medium mt-3 text-[var(--color-text-secondary)]">
                Apply to enable {currency.name} deposits and transfers. We’ll
                send your request for review.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-3 [&_button]:w-full sm:flex-row sm:[&_button]:w-auto">
                <Button onClick={closeOverlay} variant="secondary">
                  Cancel
                </Button>
                <Button disabled={loading} onClick={submitRequest}>
                  {loading ? "Sending…" : "Send request"}
                </Button>
              </div>
              {error && (
                <p className="text-body-2-medium mt-3 text-[var(--color-text-error-primary)]">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="py-3 text-center">
              <HugeiconsIcon
                aria-hidden="true"
                className="mx-auto text-[var(--color-accent-600)]"
                icon={CheckmarkCircle02Icon}
                size={40}
                strokeWidth={1.75}
              />
              <DialogTitle className="mt-3" id={titleId}>
                Request sent
              </DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                We’ll notify you when {currency.code} is available on your
                account.
              </p>
              <Button className="mt-5" onClick={closeOverlay}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CurrencyApplicationOverlay;
