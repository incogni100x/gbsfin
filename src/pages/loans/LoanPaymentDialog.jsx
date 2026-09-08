import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import FeedbackMessage from "@/components/ui/FeedbackMessage.jsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { userAccountsQueryKey } from "@/pages/dashboard/dashboardService.js";
import TransferConfirmation from "@/pages/transfer/TransferConfirmation.jsx";
import {
  getLoanPaymentRates,
  loanKeys,
  makeLoanPayment,
} from "./loanService.js";

const formatMoney = (value, currency = "USD") =>
  Number(value || 0).toLocaleString("en-US", {
    currency,
    style: "currency",
  });

export default function LoanPaymentDialog({ accounts, loan, onClose, userId }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(
    accounts.find((account) => account.id === loan.account_id)?.id ||
      accounts[0]?.id ||
      "",
  );
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState("form");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState(null);
  const { data: rates = {} } = useQuery({
    queryKey: loanKeys.paymentRates,
    queryFn: getLoanPaymentRates,
    staleTime: 5 * 60 * 1000,
  });
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const paymentAmount = Number(amount) || 0;
  const totalDue = Number(loan.remaining_balance) + Number(loan.overdue_amount);
  const sourceRate =
    selectedAccount?.currency === "USD"
      ? 1
      : rates[selectedAccount?.currency]?.rate;
  const sourceDebit = sourceRate ? paymentAmount * sourceRate : 0;
  const payment = useMutation({
    mutationFn: makeLoanPayment,
    onSuccess: async (data) => {
      setResult(data);
      setStep("success");
      setMessage("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: loanKeys.all(userId) }),
        queryClient.invalidateQueries({ queryKey: userAccountsQueryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ["transactions", userId] }),
      ]);
    },
    onError: (error) => {
      setStep("form");
      setMessage(error.message);
    },
  });

  const reviewPayment = (event) => {
    event.preventDefault();
    setMessage("");
    if (!selectedAccount) return setMessage("Select the account to pay from.");
    if (!paymentAmount || paymentAmount <= 0)
      return setMessage("Enter a valid payment amount.");
    if (paymentAmount > totalDue)
      return setMessage(`Payment cannot exceed ${formatMoney(totalDue)}.`);
    if (!sourceRate)
      return setMessage(
        `An exchange rate is unavailable for ${selectedAccount.currency}.`,
      );
    if (sourceDebit > selectedAccount.balance)
      return setMessage(
        `Your ${selectedAccount.name} account has insufficient funds.`,
      );
    setStep("review");
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-6 sm:max-w-lg sm:p-7">
        {step === "success" ? (
          <TransferConfirmation
            title="Payment completed"
            description="Your loan payment has been applied successfully."
            summaryTitle="Payment summary"
            summary={`${formatMoney(result?.payment_amount)} was applied to your loan.`}
            details={[
              {
                label: "Paid from",
                value: `${selectedAccount?.name} •••• ${selectedAccount?.accountNumber.slice(-4)}`,
              },
              {
                label: "Account debit",
                value: formatMoney(
                  result?.source_debit_amount,
                  result?.source_currency_code,
                ),
              },
              {
                label: "Overdue applied",
                value: formatMoney(result?.overdue_applied),
              },
              {
                label: "Principal applied",
                value: formatMoney(result?.principal_applied),
              },
              {
                label: "Remaining balance",
                value: formatMoney(result?.remaining_balance),
                emphasis: true,
              },
              {
                label: "New monthly payment",
                value:
                  result?.status === "completed"
                    ? "Loan paid in full"
                    : formatMoney(result?.monthly_payment),
              },
            ]}
            onDone={onClose}
          />
        ) : (
          <>
            <DialogHeader className="gap-2 pr-6 text-left">
              <DialogTitle className="text-title-3-medium sm:text-title-2-medium">
                {step === "review" ? "Review Loan Payment" : "Make an Extra Payment"}
              </DialogTitle>
              <DialogDescription>
                {step === "review"
                  ? "Confirm the amount and source account before paying."
                  : "Pay any amount towards your loan to reduce what you owe."}
              </DialogDescription>
            </DialogHeader>

            <dl className="financial-number grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-secondary-default)] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-body-medium text-[var(--color-text-secondary)]">
                  Remaining Balance
                </dt>
                <dd className="text-body-medium tabular-nums">
                  {formatMoney(loan.remaining_balance)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-[var(--color-separator-border)] pt-3">
                <dt className="text-body-medium text-[var(--color-text-secondary)]">
                  Overdue Amount
                </dt>
                <dd className="text-body-medium tabular-nums">
                  {formatMoney(loan.overdue_amount)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-[var(--color-separator-border)] pt-3">
                <dt className="text-headline-medium">Total Due</dt>
                <dd className="text-headline-medium tabular-nums">
                  {formatMoney(totalDue)}
                </dd>
              </div>
            </dl>

            {step === "form" ? (
              <form className="grid gap-5" onSubmit={reviewPayment}>
                <div className="grid gap-2">
                  <Input
                    label="Payment amount"
                    leadingAddon={
                      <span className="pl-1 text-[var(--color-text-primary)]">$</span>
                    }
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={setAmount}
                  />
                  <Button
                    className="w-fit"
                    size="small"
                    variant="ghost"
                    onClick={() => setAmount(totalDue.toFixed(2))}
                  >
                    Pay in full
                  </Button>
                </div>
                <label className="grid gap-1 text-body-medium">
                  Pay from account
                  <Select
                    aria-label="Pay from account"
                    placeholder="Select account..."
                    selectedKey={accountId || null}
                    onSelectionChange={(key) => setAccountId(String(key))}
                  >
                    {accounts.map((account) => (
                      <SelectItem id={account.id} key={account.id}>
                        <span className="grid text-left">
                          <span>
                            {account.name} (••••{account.accountNumber.slice(-4)})
                          </span>
                          <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                            Available {formatMoney(account.balance, account.currency)}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </Select>
                </label>
                {selectedAccount?.currency !== "USD" && sourceRate ? (
                  <div className="grid gap-1 rounded-[var(--radius-lg)] bg-[var(--color-background-secondary-default)] p-4">
                    <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                      Indicative exchange rate
                    </span>
                    <span className="financial-number text-body-medium">
                      1 USD = {Number(sourceRate).toLocaleString("en-US", { maximumFractionDigits: 6 })} {selectedAccount.currency}
                    </span>
                    <span className="financial-number text-body-medium">
                      Account debit {formatMoney(sourceDebit, selectedAccount.currency)}
                    </span>
                  </div>
                ) : null}
                <FeedbackMessage tone="error">{message}</FeedbackMessage>
                <DialogFooter className="gap-3 [&_button]:w-full sm:[&_button]:w-auto">
                  <DialogClose render={<Button variant="secondary">Cancel</Button>} />
                  <Button type="submit">Review payment</Button>
                </DialogFooter>
              </form>
            ) : (
              <>
                <div className="grid gap-3">
                  <h3 className="text-headline-medium">Payment details</h3>
                  <p className="text-body-medium text-[var(--color-text-secondary)]">
                    You are about to pay {formatMoney(paymentAmount)}. {formatMoney(sourceDebit, selectedAccount?.currency)} will be deducted from {selectedAccount?.name} •••• {selectedAccount?.accountNumber.slice(-4)}.
                  </p>
                </div>
                <FeedbackMessage tone="error">{message}</FeedbackMessage>
                <DialogFooter className="gap-3 [&_button]:w-full sm:[&_button]:w-auto">
                  <Button variant="secondary" onClick={() => setStep("form")}>
                    Back
                  </Button>
                  <Button
                    disabled={payment.isPending}
                    onClick={() =>
                      payment.mutate({
                        amount: paymentAmount,
                        idempotencyKey,
                        loanId: loan.id,
                        sourceAccountId: selectedAccount.id,
                      })
                    }
                  >
                    {payment.isPending ? "Processing…" : "Make payment"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
