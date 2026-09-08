import { useAuth } from "@/auth/useAuth.js";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { userAccountsQueryKey } from "@/pages/dashboard/dashboardService.js";
import {
  convertCurrency,
  exchangeRatesQueryKey,
  formatExchangeRate,
  getExchangeRates,
} from "@/pages/deposit/exchangeRateService.js";
import { depositOverviewQueryKey } from "@/pages/deposit/depositService.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  createCheckingCurrencyConversion,
  currencyTransfersQueryKey,
} from "./currencyTransferService.js";
import TransferConfirmation from "./TransferConfirmation.jsx";

function formatAmount(value, maximumFractionDigits = 6) {
  return Number(value || 0).toLocaleString("en", {
    maximumFractionDigits,
    minimumFractionDigits: 2,
  });
}

export default function CheckingCurrencyConversionDialog({
  account,
  availableCurrencies,
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("form");
  const [amount, setAmount] = useState("");
  const [destinationCode, setDestinationCode] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const destination = availableCurrencies.find(
    (currency) => currency.code === destinationCode,
  );
  const { data: rates } = useQuery({
    queryFn: getExchangeRates,
    queryKey: exchangeRatesQueryKey,
    staleTime: 60 * 60 * 1000,
  });
  const mutation = useMutation({ mutationFn: createCheckingCurrencyConversion });
  const convertedAmount = destination
    ? convertCurrency(amount, rates, "USD", destination.code)
    : null;
  const amountValue = Number(amount);
  const canReview =
    destination &&
    amountValue > 0 &&
    amountValue <= account.balance &&
    convertedAmount !== null;

  const close = () => {
    setOpen(false);
    setStep("form");
    setAmount("");
    setDestinationCode(null);
    setError("");
    setResult(null);
  };

  const submit = async () => {
    setError("");
    setStep("processing");

    try {
      const conversion = await mutation.mutateAsync({
        amount,
        destinationCurrencyCode: destination.code,
        sourceAccountId: account.id,
      });
      setResult(conversion);
      queryClient.setQueryData(userAccountsQueryKey(user.id), (items = []) =>
        items.map((item) =>
          item.id === account.id
            ? { ...item, balance: item.balance - conversion.source_amount }
            : item,
        ),
      );
      queryClient.setQueryData(
        depositOverviewQueryKey(user.id),
        (items = []) =>
          items.map((item) =>
            item.code === conversion.destination_currency_code
              ? {
                  ...item,
                  balance: item.balance + conversion.destination_amount,
                }
              : item,
          ),
      );
      void queryClient.invalidateQueries({
        queryKey: userAccountsQueryKey(user.id),
      });
      void queryClient.invalidateQueries({
        queryKey: depositOverviewQueryKey(user.id),
      });
      void queryClient.invalidateQueries({
        queryKey: currencyTransfersQueryKey(user.id),
      });
      void queryClient.invalidateQueries({
        queryKey: ["transactions", user.id],
      });
      setStep("success");
    } catch (submissionError) {
      setError(submissionError.message || "Unable to convert this balance.");
      setStep("review");
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="small" variant="secondary">
        Convert
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          {step === "form" && (
            <div>
              <DialogTitle>Convert from Checking</DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Convert USD from this Checking account into one of your
                activated currency balances.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Input
                  label="Amount"
                  leadingAddon={
                    <span className="text-body-medium pl-1 text-[var(--color-text-primary)]">
                      $
                    </span>
                  }
                  max={account.balance}
                  min="0"
                  onChange={setAmount}
                  placeholder="0.00"
                  type="number"
                  value={amount}
                />
                <div>
                  <label
                    className="text-body-medium mb-2 block"
                    id={`checking-convert-to-${account.id}`}
                  >
                    Convert to
                  </label>
                  <Select
                    aria-labelledby={`checking-convert-to-${account.id}`}
                    onSelectionChange={(key) =>
                      setDestinationCode(String(key))
                    }
                    placeholder="Select currency"
                    selectedKey={destinationCode}
                  >
                    {availableCurrencies.map((currency) => (
                      <SelectItem id={currency.code} key={currency.code}>
                        {currency.code} · {currency.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
              {destination ? (
                <div className="mt-4 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-4">
                  <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                    You’ll receive
                  </span>
                  <strong className="financial-number text-headline-medium mt-1 block">
                    {destination.symbol} {formatAmount(convertedAmount)}{" "}
                    {destination.code}
                  </strong>
                  <span className="text-body-2-medium mt-2 block text-[var(--color-text-secondary)]">
                    {formatExchangeRate(rates, "USD", destination.code)}
                  </span>
                </div>
              ) : null}
              <Button
                className="mt-5"
                disabled={!canReview}
                onClick={() => setStep("review")}
              >
                Review conversion
              </Button>
            </div>
          )}

          {step === "review" && (
            <div>
              <DialogTitle>Review conversion</DialogTitle>
              <dl className="text-body-2-medium mt-4 grid gap-3 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-4">
                <div>
                  <dt className="text-[var(--color-text-secondary)]">
                    You convert
                  </dt>
                  <dd className="text-headline-medium mt-1">
                    $ {formatAmount(amount, 2)} USD
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">
                    You receive
                  </dt>
                  <dd className="text-headline-medium mt-1">
                    {destination.symbol} {formatAmount(convertedAmount)}{" "}
                    {destination.code}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">
                    Indicative rate
                  </dt>
                  <dd className="mt-1">
                    {formatExchangeRate(rates, "USD", destination.code)}
                  </dd>
                </div>
              </dl>
              {error ? (
                <p className="text-body-2-medium mt-3 text-[var(--color-text-error-primary)]">
                  {error}
                </p>
              ) : null}
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
                <Button variant="secondary" onClick={() => setStep("form")}>
                  Back
                </Button>
                <Button onClick={submit}>Confirm conversion</Button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="py-6 text-center">
              <Spinner className="mx-auto size-6 text-[var(--color-accent-600)]" />
              <DialogTitle className="mt-4">Converting balance</DialogTitle>
            </div>
          )}

          {step === "success" && (
            <TransferConfirmation
              description="The conversion completed and your Checking and currency balances were updated."
              details={[
                {
                  emphasis: true,
                  label: "Amount converted",
                  value: `$ ${formatAmount(result?.source_amount || amount, 2)} USD`,
                },
                {
                  emphasis: true,
                  label: "Amount received",
                  value: `${destination.symbol} ${formatAmount(result?.destination_amount || convertedAmount)} ${destination.code}`,
                },
                {
                  label: "Exchange rate",
                  value: formatExchangeRate(rates, "USD", destination.code),
                },
                { label: "Status", value: "Completed" },
              ]}
              note="Your updated balances are available immediately."
              onDone={close}
              summary={`USD was converted from Checking into your ${destination.code} balance.`}
              summaryTitle="Checking conversion"
              title="Conversion complete"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
