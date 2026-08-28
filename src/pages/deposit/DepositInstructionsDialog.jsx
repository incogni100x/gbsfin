import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth/useAuth.js";
import {
  depositInstructionsQueryKey,
  getDepositInstructions,
  submitDepositConfirmation,
} from "./depositService.js";

const instructionLabels = {
  account_number: "Account number",
  beneficiary_name: "Beneficiary",
  bsb: "BSB",
  clabe: "CLABE",
  iban: "IBAN",
  network: "Network",
  routing_number: "Routing number",
  sort_code: "Sort code",
  swift_bic: "SWIFT / BIC",
  wallet_address: "Wallet address",
};

function DepositInstructionsDialog({ currency, onSubmitted }) {
  const { profile } = useAuth();
  const [amount, setAmount] = useState("");
  const [detailsReady, setDetailsReady] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [senderName, setSenderName] = useState(
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
  );
  const [step, setStep] = useState("form");
  const [submitting, setSubmitting] = useState(false);
  const { data: instructions = [], error: instructionsError, isPending } =
    useQuery({
      enabled: open && step === "details",
      queryFn: () => getDepositInstructions(currency.code),
      queryKey: depositInstructionsQueryKey(currency.code),
      staleTime: 10 * 60 * 1000,
    });
  const instruction = instructions[0];

  useEffect(() => {
    if (!open || step !== "details" || isPending) return undefined;

    const readyTimer = window.setTimeout(() => setDetailsReady(true), 700);
    return () => window.clearTimeout(readyTimer);
  }, [isPending, open, step]);

  const closeDialog = () => {
    setOpen(false);
    setDetailsReady(false);
    setStep("form");
    setAmount("");
    setError("");
  };

  const confirmSent = async () => {
    setError("");
    setSubmitting(true);

    try {
      await submitDepositConfirmation({
        amount,
        currencyCode: currency.code,
        instructionId: instruction.id,
        senderName,
      });
      await onSubmitted();
      setStep("submitted");
    } catch (submissionError) {
      setError(submissionError.message || "Unable to confirm this deposit.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="small">
        Deposit
      </Button>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeDialog();
        }}
        open={open}
      >
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          {step === "submitted" ? (
            <div className="py-3 text-center">
              <HugeiconsIcon
                aria-hidden="true"
                className="mx-auto text-[var(--color-accent-600)]"
                icon={CheckmarkCircle02Icon}
                size={40}
                strokeWidth={1.75}
              />
              <DialogTitle className="mt-3">Deposit submitted</DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Your confirmation is pending review. Your balance will update
                after the deposit is approved.
              </p>
              <Button className="mt-5" onClick={closeDialog}>
                Done
              </Button>
            </div>
          ) : step === "form" ? (
            <div>
              <DialogTitle>Deposit {currency.code}</DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Enter the amount and the name on the sending account.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Input
                  label="Amount to deposit"
                  leadingAddon={
                    <span className="text-body-medium shrink-0 pl-1 text-[var(--color-text-secondary)]">
                      {currency.symbol}
                    </span>
                  }
                  min="0"
                  onChange={setAmount}
                  placeholder="0.00"
                  type="number"
                  value={amount}
                />
                <Input
                  label="Sender name"
                  onChange={setSenderName}
                  placeholder="Name on sending account"
                  value={senderName}
                />
              </div>

              <Button
                className="mt-5"
                disabled={!Number.parseFloat(amount) || !senderName.trim()}
                onClick={() => {
                  setDetailsReady(false);
                  setStep("details");
                }}
              >
                Continue
              </Button>
            </div>
          ) : (
            <div>
              <DialogTitle>{currency.code} payment details</DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Send {currency.symbol} {amount} using the details below.
              </p>

              {isPending || !detailsReady ? (
                <div className="mt-5 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] px-4 py-10 text-center">
                  <Spinner className="mx-auto size-6 text-[var(--color-accent-600)]" />
                  <p className="text-body-medium mt-3 text-[var(--color-text-secondary)]">
                    Generating payment details…
                  </p>
                </div>
              ) : instructionsError ? (
                <p className="text-body-medium mt-5 text-[var(--color-text-error-primary)]">
                  {instructionsError.message || "Unable to load deposit details."}
                </p>
              ) : !instruction ? (
                <p className="text-body-medium mt-5 text-[var(--color-text-secondary)]">
                  Deposit details are not available for this currency.
                </p>
              ) : (
                <>
                  <div className="mt-5 rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-secondary-default)] p-4">
                    <strong className="text-headline-medium">
                      {instruction.payment_rail}
                    </strong>
                    <dl className="financial-number text-body-2-medium mt-4 grid gap-3">
                      {Object.entries(instructionLabels).map(([key, label]) =>
                        instruction[key] ? (
                          <div key={key}>
                            <dt className="text-[var(--color-text-secondary)]">
                              {label}
                            </dt>
                            <dd className="mt-1 break-all text-[var(--color-text-primary)]">
                              {instruction[key]}
                            </dd>
                          </div>
                        ) : null,
                      )}
                    </dl>
                  </div>

                  <div className="mt-5 flex flex-col-reverse gap-3 [&_button]:w-full sm:flex-row sm:[&_button]:w-auto">
                    <Button
                      onClick={() => {
                        setDetailsReady(false);
                        setStep("form");
                      }}
                      variant="secondary"
                    >
                      Back
                    </Button>
                    <Button disabled={submitting} onClick={confirmSent}>
                      {submitting ? "Submitting…" : "I’ve sent the funds"}
                    </Button>
                  </div>
                  {error && (
                    <p className="text-body-2-medium mt-3 text-[var(--color-text-error-primary)]">
                      {error}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DepositInstructionsDialog;
