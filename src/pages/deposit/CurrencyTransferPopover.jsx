import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Radio, RadioGroup } from "@/components/base/radio/radio";
import { useAuth } from "@/auth/useAuth.js";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getCurrentUserAccounts,
  userAccountsQueryKey,
} from "@/pages/dashboard/dashboardService.js";
import { createCurrencyTransfer } from "@/pages/transfer/currencyTransferService.js";
import { depositOverviewQueryKey } from "./depositService.js";
import {
  convertCurrency,
  exchangeRatesQueryKey,
  formatExchangeRate,
  getExchangeRates,
} from "./exchangeRateService.js";

function CurrencyTransferPopover({ availableCurrencies, currency }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canTransferToBank = currency.code === "USD";
  const [amount, setAmount] = useState("");
  const [destinationType, setDestinationType] = useState(
    canTransferToBank ? "account" : "currency",
  );
  const [open, setOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [targetCurrency, setTargetCurrency] = useState(null);
  const [step, setStep] = useState("choose");
  const [transferError, setTransferError] = useState("");
  const [transferResult, setTransferResult] = useState(null);
  const { data: bankAccounts = [] } = useQuery({
    enabled: Boolean(user?.id),
    queryFn: getCurrentUserAccounts,
    queryKey: userAccountsQueryKey(user?.id),
    staleTime: 30 * 1000,
  });
  const { data: exchangeRates } = useQuery({
    queryFn: getExchangeRates,
    queryKey: exchangeRatesQueryKey,
    staleTime: 60 * 60 * 1000,
  });

  const transferMutation = useMutation({
    mutationFn: createCurrencyTransfer,
  });

  const closeDialog = () => {
    setOpen(false);
    setStep("choose");
    setDestinationType(canTransferToBank ? "account" : "currency");
    setSelectedAccount(null);
    setTargetCurrency(null);
    setAmount("");
    setTransferError("");
    setTransferResult(null);
  };

  const hasDestination =
    destinationType === "account" ? selectedAccount : targetCurrency;
  const destinationCurrency =
    destinationType === "account"
      ? availableCurrencies.find(
          (item) => item.code === selectedAccount?.currency,
        )
      : targetCurrency;
  const amountValue = Number.parseFloat(amount);
  const convertedAmount = destinationCurrency
    ? convertCurrency(
        amount,
        exchangeRates,
        currency.code,
        destinationCurrency.code,
      )
    : null;
  const canReview =
    Boolean(hasDestination) &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    amountValue <= currency.balance &&
    convertedAmount !== null;

  const processTransfer = async () => {
    setTransferError("");
    setStep("processing");

    try {
      const result = await transferMutation.mutateAsync({
        amount,
        destinationAccountId:
          destinationType === "account" ? selectedAccount.id : null,
        destinationCurrencyCode:
          destinationType === "currency" ? targetCurrency.code : null,
        destinationType,
        sourceCurrencyCode: currency.code,
      });

      queryClient.setQueryData(
        depositOverviewQueryKey(user.id),
        (currentCurrencies = []) =>
          currentCurrencies.map((item) => {
            if (item.code === result.source_currency_code) {
              return {
                ...item,
                balance: item.balance - result.source_amount,
              };
            }

            if (
              result.destination_type === "currency_balance" &&
              item.code === result.destination_currency_code
            ) {
              return {
                ...item,
                balance: item.balance + result.destination_amount,
              };
            }

            return item;
          }),
      );

      if (result.destination_type === "bank_account") {
        queryClient.setQueryData(
          userAccountsQueryKey(user.id),
          (currentAccounts = []) =>
            currentAccounts.map((account) =>
              account.id === result.destination_account_id
                ? {
                    ...account,
                    balance: account.balance + result.destination_amount,
                  }
                : account,
            ),
        );
      }

      setTransferResult(result);
      setStep("confirmation");

      void queryClient.invalidateQueries({
        queryKey: depositOverviewQueryKey(user.id),
      });
      void queryClient.invalidateQueries({
        queryKey: userAccountsQueryKey(user.id),
      });
      void queryClient.invalidateQueries({
        queryKey: ["transactions", user.id],
      });
    } catch (error) {
      setTransferError(error.message || "The transfer could not be completed.");
      setStep("review");
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="small" variant="secondary">
        Transfer
      </Button>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeDialog();
        }}
        open={open}
      >
        <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
          {step === "choose" && (
            <div>
              <DialogTitle id={`transfer-title-${currency.code}`}>
                {destinationType === "account"
                  ? "Transfer to Bank Account"
                  : "Transfer to Currency Balance"}
              </DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                {destinationType === "account"
                    ? "Move money from your USD currency balance into a USD bank account."
                    : `Convert your ${currency.code} balance into another enabled currency.`}
              </p>
              {canTransferToBank ? (
                <RadioGroup
                  aria-label="Transfer destination type"
                  className="mt-5 grid gap-3 sm:grid-cols-2"
                  onChange={(value) => {
                    setDestinationType(value);
                    setSelectedAccount(null);
                    setTargetCurrency(null);
                  }}
                  value={destinationType}
                >
                  <Radio
                    className="whitespace-nowrap rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-500)]"
                    value="account"
                  >
                    To Bank Account
                  </Radio>
                  <Radio
                    className="whitespace-nowrap rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-500)]"
                    value="currency"
                  >
                    To Currency Account
                  </Radio>
                </RadioGroup>
              ) : (
                <div className="mt-5 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-3">
                  <span className="text-body-2-medium block text-[var(--color-text-secondary)]">
                    Current balance
                  </span>
                  <strong className="text-headline-medium mt-1 block text-[var(--color-text-primary)]">
                    {currency.symbol}{" "}
                    {currency.balance.toLocaleString("en", {
                      maximumFractionDigits:
                        currency.currency_kind === "stablecoin" ? 6 : 2,
                      minimumFractionDigits: 2,
                    })}{" "}
                    {currency.code}
                  </strong>
                </div>
              )}
              <Input
                className="mt-5"
                label="Amount"
                leadingAddon={
                  <span className="text-body-medium shrink-0 pl-1 text-[var(--color-text-primary)]">
                    {currency.symbol}
                  </span>
                }
                onChange={setAmount}
                placeholder="0.00"
                min="0"
                step={currency.currency_kind === "stablecoin" ? "0.000001" : "0.01"}
                type="number"
                value={amount}
              />

              {destinationType === "account" ? (
                <>
                  <label
                    className="text-body-medium mt-5 block text-[var(--color-text-primary)]"
                    htmlFor={`bank-account-${currency.code}`}
                  >
                    Destination bank account
                  </label>
                  <select
                    className="text-body-medium mt-2 w-full rounded-[var(--radius-2lg)] border border-[var(--color-border-button-default)] bg-transparent px-3 py-2 text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus-ring)] focus:ring-1 focus:ring-[var(--color-border-focus-ring)]"
                    id={`bank-account-${currency.code}`}
                    onChange={(event) =>
                      setSelectedAccount(
                        bankAccounts.find(
                          (account) => account.id === event.target.value,
                        ) ?? null,
                      )
                    }
                    value={selectedAccount?.id ?? ""}
                  >
                    <option value="">Select an account</option>
                    {bankAccounts
                      .filter((account) => account.currency === "USD")
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} — ••••{" "}
                          {account.accountNumber.slice(-4)} ({account.currency})
                        </option>
                      ))}
                  </select>
                </>
              ) : (
                <>
                  <label
                    className="text-body-medium mt-5 block text-[var(--color-text-primary)]"
                    htmlFor={`target-currency-${currency.code}`}
                  >
                    Destination currency
                  </label>
                  <select
                    className="text-body-medium mt-2 w-full rounded-[var(--radius-2lg)] border border-[var(--color-border-button-default)] bg-transparent px-3 py-2 text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus-ring)] focus:ring-1 focus:ring-[var(--color-border-focus-ring)]"
                    id={`target-currency-${currency.code}`}
                    onChange={(event) =>
                      setTargetCurrency(
                        availableCurrencies.find(
                          (item) => item.code === event.target.value,
                        ) ?? null,
                      )
                    }
                    value={targetCurrency?.code ?? ""}
                  >
                    <option value="">Select currency</option>
                    {availableCurrencies
                      .filter((item) => item.code !== currency.code)
                      .map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.code} — {item.name}
                        </option>
                      ))}
                  </select>
                </>
              )}

              <Button
                className="mt-5"
                disabled={!canReview}
                onClick={() => {
                  setTransferError("");
                  setStep("review");
                }}
              >
                Review transfer
              </Button>
            </div>
          )}

          {step === "review" && hasDestination && (
            <div>
              <DialogTitle id={`transfer-title-${currency.code}`}>
                Review transfer
              </DialogTitle>
              <div className="mt-4 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-4">
                <dl className="financial-number text-body-2-medium grid gap-3">
                  <div>
                    <dt className="text-[var(--color-text-secondary)]">From</dt>
                    <dd className="text-headline-medium mt-1 text-[var(--color-text-primary)]">
                      {currency.name} balance
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-secondary)]">
                      You send
                    </dt>
                    <dd className="text-headline-medium mt-1 text-[var(--color-text-primary)]">
                      {currency.symbol} {amount} {currency.code}
                    </dd>
                  </div>
                  {destinationType === "account" ? (
                    <div>
                      <dt className="text-[var(--color-text-secondary)]">
                        Transfer to
                      </dt>
                      <dd className="text-headline-medium mt-1 text-[var(--color-text-primary)]">
                        {selectedAccount.name} · ••••{" "}
                        {selectedAccount.accountNumber.slice(-4)}
                      </dd>
                    </div>
                  ) : null}
                  {destinationCurrency && (
                    <>
                      <div>
                        <dt className="text-[var(--color-text-secondary)]">
                          Indicative conversion rate
                        </dt>
                        <dd className="text-headline-medium mt-1 text-[var(--color-text-primary)]">
                          {formatExchangeRate(
                            exchangeRates,
                            currency.code,
                            destinationCurrency.code,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[var(--color-text-secondary)]">
                          You receive
                        </dt>
                        <dd className="text-headline-medium mt-1 text-[var(--color-text-primary)]">
                          {destinationCurrency.symbol}{" "}
                          {convertedAmount?.toFixed(2) ?? "—"}{" "}
                          {destinationCurrency.code}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
              {transferError ? (
                <p className="text-body-2-medium mt-3 text-[var(--color-text-error-primary)]">
                  {transferError}
                </p>
              ) : null}
              <div className="mt-5 flex flex-col-reverse gap-3 [&_button]:w-full sm:flex-row sm:[&_button]:w-auto">
                <Button onClick={() => setStep("choose")} variant="secondary">
                  Back
                </Button>
                <Button onClick={processTransfer}>
                  Process transfer
                </Button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="py-5 text-center">
              <Spinner className="mx-auto size-6 text-[var(--color-accent-600)]" />
              <DialogTitle
                className="mt-4"
                id={`transfer-title-${currency.code}`}
              >
                Processing transfer
              </DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                {destinationType === "account"
                  ? "Please wait while we move the funds to your account."
                  : "Please wait while we convert your balance."}
              </p>
              <Button className="mt-5" disabled>
                <Spinner />
                Processing
              </Button>
            </div>
          )}

          {step === "confirmation" && hasDestination && transferResult && (
            <div className="py-3 text-center">
              <HugeiconsIcon
                aria-hidden="true"
                className="mx-auto text-[var(--color-accent-600)]"
                icon={CheckmarkCircle02Icon}
                size={40}
                strokeWidth={1.75}
              />
              <DialogTitle
                className="mt-3"
                id={`transfer-title-${currency.code}`}
              >
                Transfer complete
              </DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Funds have been transferred to{" "}
                {destinationType === "account"
                  ? `your ${selectedAccount.name}`
                  : `your ${targetCurrency.code} balance`}
                .
              </p>
              <div className="mt-5 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-4 text-left">
                <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                  Transaction details
                </span>
                <dl className="financial-number text-body-2-medium mt-3 grid gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--color-text-secondary)]">Amount</dt>
                    <dd className="text-[var(--color-text-primary)]">
                      {currency.symbol} {transferResult.source_amount.toFixed(2)}{" "}
                      {currency.code}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--color-text-secondary)]">
                      Destination
                    </dt>
                    <dd className="text-right text-[var(--color-text-primary)]">
                      {destinationType === "account"
                        ? `${selectedAccount.name} · •••• ${selectedAccount.accountNumber.slice(-4)}`
                        : `${targetCurrency.name} balance`}
                    </dd>
                  </div>
                  {destinationCurrency && (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[var(--color-text-secondary)]">
                          Exchange rate
                        </dt>
                        <dd className="text-right text-[var(--color-text-primary)]">
                          {formatExchangeRate(
                            exchangeRates,
                            currency.code,
                            destinationCurrency.code,
                          )}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[var(--color-text-secondary)]">
                          You receive
                        </dt>
                        <dd className="text-[var(--color-text-primary)]">
                          {destinationCurrency.symbol}{" "}
                          {transferResult.destination_amount.toFixed(2)}{" "}
                          {destinationCurrency.code}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
              <Button className="mt-5" onClick={closeDialog}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CurrencyTransferPopover;
