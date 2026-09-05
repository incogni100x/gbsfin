import { useAuth } from "@/auth/useAuth.js";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { depositOverviewQueryKey } from "@/pages/deposit/depositService.js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  currencyTransfersQueryKey,
  requestCurrencyTransfer,
} from "./currencyTransferService.js";
import TransferConfirmation from "./TransferConfirmation.jsx";

const emptyDetails = {
  accountHolderName: "",
  accountNumber: "",
  accountType: "",
  bankAddress: "",
  bankName: "",
  beneficiaryAddress: "",
  bsb: "",
  clabe: "",
  iban: "",
  network: "",
  routingNumber: "",
  sortCode: "",
  swiftBic: "",
  walletAddress: "",
};

const currencyFields = {
  AED: [
    ["iban", "IBAN", "AE070331234567890123456"],
    ["swiftBic", "SWIFT / BIC", "Enter SWIFT or BIC"],
  ],
  AUD: [
    ["bsb", "BSB", "000-000"],
    ["accountNumber", "Account number", "Enter account number"],
  ],
  EUR: [
    ["iban", "IBAN", "Enter IBAN"],
    ["swiftBic", "SWIFT / BIC", "Enter SWIFT or BIC"],
  ],
  GBP: [
    ["sortCode", "Sort code", "00-00-00"],
    ["accountNumber", "Account number", "Enter account number"],
  ],
  MXN: [["clabe", "CLABE", "18-digit CLABE"]],
  NZD: [["accountNumber", "New Zealand account number", "00-0000-0000000-00"]],
  USD: [
    ["routingNumber", "Routing number", "9-digit routing number"],
    ["accountNumber", "Account number", "Enter account number"],
  ],
};

function createInitialDetails(currency, profile) {
  return {
    ...emptyDetails,
    accountHolderName:
      `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim(),
    network:
      currency.code === "USDC"
        ? "Ethereum (ERC20)"
        : currency.code === "USDT"
          ? "Tron (TRC20)"
          : "",
  };
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="text-headline-medium mt-1 break-words text-[var(--color-text-primary)]">
        {value}
      </dd>
    </div>
  );
}

function CurrencyTransferDialog({ currency }) {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const isStablecoin = currency.currency_kind === "stablecoin";
  const requiredCurrencyFields = isStablecoin
    ? ["walletAddress"]
    : currencyFields[currency.code].map(([key]) => key);
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState(() =>
    createInitialDetails(currency, profile),
  );
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("form");
  const mutation = useMutation({ mutationFn: requestCurrencyTransfer });
  const amountValue = Number.parseFloat(amount);
  const commonComplete = isStablecoin
    ? true
    : Boolean(
        details.accountHolderName.trim() &&
        details.bankName.trim() &&
        details.beneficiaryAddress.trim(),
      );
  const currencyComplete = requiredCurrencyFields.every((key) =>
    details[key].trim(),
  );
  const accountTypeComplete =
    currency.code !== "USD" || Boolean(details.accountType);
  const canReview =
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    amountValue <= currency.balance &&
    commonComplete &&
    currencyComplete &&
    accountTypeComplete;

  const setField = (field, value) => {
    setDetails((current) => ({ ...current, [field]: value }));
  };

  const closeDialog = () => {
    setOpen(false);
    setStep("form");
    setAmount("");
    setError("");
    setDetails(createInitialDetails(currency, profile));
  };

  const submitTransfer = async () => {
    setError("");
    setStep("processing");

    try {
      const transfer = await mutation.mutateAsync({
        amount,
        currencyCode: currency.code,
        details,
      });

      queryClient.setQueryData(
        depositOverviewQueryKey(user.id),
        (currentCurrencies = []) =>
          currentCurrencies.map((item) =>
            item.code === currency.code
              ? { ...item, balance: item.balance - transfer.amount }
              : item,
          ),
      );
      void queryClient.invalidateQueries({
        queryKey: depositOverviewQueryKey(user.id),
      });
      void queryClient.invalidateQueries({
        queryKey: currencyTransfersQueryKey(user.id),
      });
      void queryClient.invalidateQueries({
        queryKey: ["transactions", user.id],
      });
      setStep("submitted");
    } catch (submissionError) {
      setError(submissionError.message || "Unable to submit this transfer.");
      setStep("review");
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="small">
        Transfer
      </Button>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeDialog();
        }}
        open={open}
      >
        <DialogContent aria-describedby={undefined} className="sm:max-w-xl">
          {step === "form" && (
            <div>
              <DialogTitle>Transfer {currency.code}</DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Enter the destination details for your {currency.name} transfer.
              </p>

              <div className="mt-5 grid max-h-[62vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
                <Input
                  label="Amount"
                  leadingAddon={
                    <span className="text-body-medium shrink-0 pl-1 text-[var(--color-text-primary)]">
                      {currency.symbol}
                    </span>
                  }
                  max={currency.balance}
                  min="0"
                  onChange={setAmount}
                  placeholder="0.00"
                  step={isStablecoin ? "0.000001" : "0.01"}
                  type="number"
                  value={amount}
                />

                {isStablecoin ? (
                  <>
                    <Input
                      label="Wallet address"
                      onChange={(value) => setField("walletAddress", value)}
                      placeholder={`Enter ${currency.code} wallet address`}
                      value={details.walletAddress}
                    />
                    <Input isReadOnly label="Network" value={details.network} />
                  </>
                ) : (
                  <>
                    <Input
                      label="Account holder name"
                      onChange={(value) => setField("accountHolderName", value)}
                      placeholder="Name on the receiving account"
                      value={details.accountHolderName}
                    />
                    <Input
                      label="Bank name"
                      onChange={(value) => setField("bankName", value)}
                      placeholder="Receiving bank name"
                      value={details.bankName}
                    />
                    <Input
                      label="Beneficiary address"
                      onChange={(value) =>
                        setField("beneficiaryAddress", value)
                      }
                      placeholder="Street, city, and country"
                      value={details.beneficiaryAddress}
                    />
                    <Input
                      label="Bank address (optional)"
                      onChange={(value) => setField("bankAddress", value)}
                      placeholder="Bank branch address"
                      value={details.bankAddress}
                    />
                    {currencyFields[currency.code].map(
                      ([field, label, placeholder]) => (
                        <Input
                          key={field}
                          label={label}
                          onChange={(value) => setField(field, value)}
                          placeholder={placeholder}
                          required={field === "routingNumber"}
                          value={details[field]}
                        />
                      ),
                    )}
                    {currency.code === "USD" && (
                      <div>
                        <label
                          className="text-body-medium block"
                          htmlFor={`account-type-${currency.code}`}
                        >
                          Account type
                        </label>
                        <select
                          className="text-body-medium mt-2 w-full rounded-[var(--radius-2lg)] border border-[var(--color-border-button-default)] bg-transparent px-3 py-2 text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus-ring)] focus:ring-1 focus:ring-[var(--color-border-focus-ring)]"
                          id={`account-type-${currency.code}`}
                          onChange={(event) =>
                            setField("accountType", event.target.value)
                          }
                          value={details.accountType}
                        >
                          <option value="">Select account type</option>
                          <option value="checking">Checking</option>
                          <option value="savings">Savings</option>
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>

              <Button
                className="mt-5"
                disabled={!canReview}
                onClick={() => setStep("review")}
              >
                Review transfer
              </Button>
            </div>
          )}

          {step === "review" && (
            <div>
              <DialogTitle>Review transfer</DialogTitle>
              <div className="mt-4 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-4">
                <dl className="financial-number text-body-2-medium grid gap-3">
                  <Detail
                    label="Amount"
                    value={`${currency.symbol} ${amount} ${currency.code}`}
                  />
                  <Detail
                    label={isStablecoin ? "Wallet" : "Account holder"}
                    value={
                      isStablecoin
                        ? details.walletAddress
                        : details.accountHolderName
                    }
                  />
                  <Detail
                    label={isStablecoin ? "Network" : "Bank"}
                    value={isStablecoin ? details.network : details.bankName}
                  />
                  <Detail
                    label="Status after submission"
                    value="Pending review"
                  />
                </dl>
              </div>
              <p className="text-body-2-medium mt-3 text-[var(--color-text-secondary)]">
                The amount will be reserved from your available balance while
                this request is reviewed.
              </p>
              {error && (
                <p className="text-body-2-medium mt-3 text-[var(--color-text-error-primary)]">
                  {error}
                </p>
              )}
              <div className="mt-5 flex flex-col-reverse gap-3 [&_button]:w-full sm:flex-row sm:[&_button]:w-auto">
                <Button onClick={() => setStep("form")} variant="secondary">
                  Back
                </Button>
                <Button disabled={mutation.isPending} onClick={submitTransfer}>
                  Submit transfer
                </Button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="py-5 text-center">
              <Spinner className="mx-auto size-6 text-[var(--color-accent-600)]" />
              <DialogTitle className="mt-4">Submitting transfer</DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Please wait while we securely reserve the funds.
              </p>
            </div>
          )}

          {step === "submitted" && (
            <TransferConfirmation
              description="Your currency transfer was submitted and is awaiting review."
              details={[
                { label: "Transfer amount", value: `${currency.symbol} ${Number(amount).toLocaleString("en", { maximumFractionDigits: 6 })} ${currency.code}`, emphasis: true },
                { label: isStablecoin ? "Wallet" : "Recipient", value: isStablecoin ? details.walletAddress : details.accountHolderName },
                { label: isStablecoin ? "Network" : "Bank", value: isStablecoin ? details.network : details.bankName },
                { label: "Status", value: "Pending review" },
              ]}
              note="We’ll notify you when the transfer has been reviewed. Rejected requests are automatically returned to your balance."
              onDone={closeDialog}
              summary="The amount has been reserved from your currency balance while the transfer is reviewed."
              summaryTitle="Transfer review"
              title="Transfer submitted"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CurrencyTransferDialog;
