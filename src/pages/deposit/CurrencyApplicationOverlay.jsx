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
  const [applicationReference, setApplicationReference] = useState("");
  const titleId = `currency-application-title-${currency.code}`;

  const closeOverlay = () => {
    setOpen(false);
    setSubmitted(false);
    setApplicationReference("");
    setError("");
  };

  const submitRequest = async () => {
    setError("");
    setLoading(true);

    try {
      const result = await onRequest(currency.code);
      const request = Array.isArray(result) ? result[0] : result;

      if (!request?.application_reference) {
        throw new Error(
          "Your request was sent, but its application ID could not be loaded. Please try again.",
        );
      }

      setApplicationReference(request.application_reference);
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.message || "Unable to send your request.");
    } finally {
      setLoading(false);
    }
  };

  if (requestStatus === "pending" && !open) {
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
                Application submitted
              </DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Your request to enable {currency.code} has been sent for
                review.
              </p>
              <div className="mt-5 rounded-xl border border-border-component-detail-container px-4 py-3 text-left">
                <p className="text-caption-1-medium text-[var(--color-text-secondary)]">
                  Application ID
                </p>
                <p className="text-body-2-medium mt-1 break-all font-mono text-[var(--color-text-primary)] select-all">
                  {applicationReference}
                </p>
              </div>
              <p className="text-body-2-regular mt-4 text-[var(--color-text-secondary)]">
                Contact{" "}
                <a
                  className="font-medium text-[var(--color-accent-700)] underline underline-offset-2"
                  href={`mailto:deposit@globalstripefin.com?subject=${encodeURIComponent(
                    `${currency.code} application ${applicationReference}`,
                  )}`}
                >
                  deposit@globalstripefin.com
                </a>{" "}
                and include this application ID.
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
