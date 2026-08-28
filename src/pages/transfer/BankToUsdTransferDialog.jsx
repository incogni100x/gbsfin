import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useAuth } from "@/auth/useAuth.js";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { depositOverviewQueryKey } from "@/pages/deposit/depositService.js";
import { userAccountsQueryKey } from "@/pages/dashboard/dashboardService.js";
import { transferBankAccountToUsdBalance } from "./currencyTransferService.js";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

export default function BankToUsdTransferDialog({ account }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const amountValue = Number(amount) || 0;
  const transfer = useMutation({
    mutationFn: transferBankAccountToUsdBalance,
    onSuccess: async () => {
      setStep("success");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: userAccountsQueryKey(user.id),
        }),
        queryClient.invalidateQueries({
          queryKey: depositOverviewQueryKey(user.id),
        }),
        queryClient.invalidateQueries({ queryKey: ["transactions", user.id] }),
      ]);
    },
    onError: (failure) => {
      setError(failure.message);
      setStep("review");
    },
  });
  const close = () => {
    setOpen(false);
    setAmount("");
    setStep("form");
    setError("");
    transfer.reset();
  };
  return (
    <>
      <Button onClick={() => setOpen(true)} size="small" variant="secondary">
        Transfer to USD balance
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? setOpen(true) : close())}
      >
        <DialogContent className="financial-number sm:max-w-lg sm:p-7">
          {step === "form" && (
            <>
              <DialogHeader className="pr-6 text-left">
                <DialogTitle>Transfer to USD balance</DialogTitle>
                <DialogDescription>
                  Move money from this bank account into your USD currency
                  balance.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-[var(--radius-lg)] bg-[var(--color-background-secondary-default)] p-4">
                <p className="text-body-medium">
                  {account.name} · •••• {account.accountNumber.slice(-4)}
                </p>
                <p className="text-body-2-medium text-[var(--color-text-secondary)]">
                  Available {money(account.balance)}
                </p>
              </div>
              <Input
                label="Amount to transfer"
                leadingAddon={
                  <span className="pl-1 text-[var(--color-text-secondary)]">
                    $
                  </span>
                }
                min="0"
                step="0.01"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={setAmount}
              />
              <DialogFooter className="[&_button]:w-full sm:[&_button]:w-auto">
                <Button
                  disabled={!amountValue || amountValue > account.balance}
                  onClick={() => setStep("review")}
                >
                  Review transfer
                </Button>
              </DialogFooter>
            </>
          )}
          {step === "review" && (
            <>
              <DialogHeader className="pr-6 text-left">
                <DialogTitle>Review transfer</DialogTitle>
                <DialogDescription>
                  Confirm the details before moving your money.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-secondary-default)] p-4">
                <p className="text-body-medium flex justify-between gap-4">
                  <span>From</span>
                  <span className="text-right">
                    {account.name} · •••• {account.accountNumber.slice(-4)}
                  </span>
                </p>
                <p className="text-body-medium flex justify-between gap-4">
                  <span>To</span>
                  <span>USD currency balance</span>
                </p>
                <p className="text-body-medium flex justify-between gap-4 border-t border-[var(--color-separator-border)] pt-3">
                  <span>Amount</span>
                  <span>{money(amountValue)}</span>
                </p>
              </div>
              {error && (
                <p className="text-body-medium text-[var(--color-text-error-primary)]">
                  {error}
                </p>
              )}
              <DialogFooter className="gap-3 [&_button]:w-full sm:[&_button]:w-auto">
                <Button variant="secondary" onClick={() => setStep("form")}>
                  Back
                </Button>
                <Button
                  disabled={transfer.isPending}
                  onClick={() =>
                    transfer.mutate({
                      accountId: account.id,
                      amount: amountValue,
                    })
                  }
                >
                  {transfer.isPending ? "Transferring…" : "Confirm transfer"}
                </Button>
              </DialogFooter>
            </>
          )}
          {step === "success" && (
            <div className="py-2 text-center">
              <HugeiconsIcon
                aria-hidden="true"
                className="mx-auto text-[var(--color-accent-600)]"
                icon={CheckmarkCircle02Icon}
                size={44}
                strokeWidth={1.75}
              />
              <DialogTitle className="mt-4">Transfer complete</DialogTitle>
              <p className="text-body-medium mt-2 text-[var(--color-text-secondary)]">
                {money(amountValue)} was moved from {account.name} to your USD
                currency balance.
              </p>
              <Button className="mt-6" onClick={close}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
