import { useAuth } from "@/auth/useAuth.js";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { depositOverviewQueryKey } from "@/pages/deposit/depositService.js";
import {
  convertCurrency,
  exchangeRatesQueryKey,
  formatExchangeRate,
  getExchangeRates,
} from "@/pages/deposit/exchangeRateService.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { createCurrencyConversion } from "./currencyTransferService.js";
import TransferConfirmation from "./TransferConfirmation.jsx";

export default function CurrencyConversionDialog({
  availableCurrencies,
  currency,
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("form");
  const [amount, setAmount] = useState("");
  const [targetCode, setTargetCode] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const targets = availableCurrencies.filter(
    (item) => item.code !== currency.code,
  );
  const target = targets.find((item) => item.code === targetCode);
  const { data: rates } = useQuery({
    queryFn: getExchangeRates,
    queryKey: exchangeRatesQueryKey,
    staleTime: 60 * 60 * 1000,
  });
  const mutation = useMutation({ mutationFn: createCurrencyConversion });
  const convertedAmount = target
    ? convertCurrency(amount, rates, currency.code, target.code)
    : null;
  const amountValue = Number(amount);
  const canReview =
    target &&
    amountValue > 0 &&
    amountValue <= currency.balance &&
    convertedAmount !== null;

  const close = () => {
    setOpen(false);
    setStep("form");
    setAmount("");
    setTargetCode(null);
    setError("");
    setResult(null);
  };

  const submit = async () => {
    setError("");
    setStep("processing");
    try {
      const conversion = await mutation.mutateAsync({
        amount,
        destinationCurrencyCode: target.code,
        sourceCurrencyCode: currency.code,
      });
      setResult(conversion);
      queryClient.setQueryData(depositOverviewQueryKey(user.id), (items = []) =>
        items.map((item) => {
          if (item.code === conversion.source_currency_code)
            return {
              ...item,
              balance: item.balance - conversion.source_amount,
            };
          if (item.code === conversion.destination_currency_code)
            return {
              ...item,
              balance: item.balance + conversion.destination_amount,
            };
          return item;
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: depositOverviewQueryKey(user.id),
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
              <DialogTitle>Convert {currency.code}</DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Convert this balance into another enabled currency.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Input
                  label="Amount"
                  leadingAddon={
                    <span className="text-body-medium pl-1 text-[var(--color-text-primary)]">
                      {currency.symbol}
                    </span>
                  }
                  min="0"
                  max={currency.balance}
                  onChange={setAmount}
                  placeholder="0.00"
                  type="number"
                  value={amount}
                />
                <div>
                  <label
                    className="text-body-medium mb-2 block"
                    id={`convert-to-${currency.code}`}
                  >
                    Convert to
                  </label>
                  <Select
                    aria-labelledby={`convert-to-${currency.code}`}
                    onSelectionChange={(key) => setTargetCode(String(key))}
                    placeholder="Select currency"
                    selectedKey={targetCode}
                  >
                    {targets.map((item) => (
                      <SelectItem id={item.code} key={item.code}>
                        {item.code} · {item.name}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
              {target && (
                <div className="mt-4 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-4">
                  <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                    You’ll receive
                  </span>
                  <strong className="financial-number text-headline-medium mt-1 block">
                    {target.symbol}{" "}
                    {(convertedAmount || 0).toLocaleString("en", {
                      maximumFractionDigits: 6,
                    })}
                    {target.code}
                  </strong>
                  <span className="text-body-2-medium mt-2 block text-[var(--color-text-secondary)]">
                    {formatExchangeRate(rates, currency.code, target.code)}
                  </span>
                </div>
              )}
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
                    {currency.symbol} {amount} {currency.code}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">
                    You receive
                  </dt>
                  <dd className="text-headline-medium mt-1">
                    {target.symbol}{" "}
                    {convertedAmount?.toLocaleString("en", {
                      maximumFractionDigits: 6,
                    })}
                    {target.code}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-text-secondary)]">
                    Indicative rate
                  </dt>
                  <dd className="mt-1">
                    {formatExchangeRate(rates, currency.code, target.code)}
                  </dd>
                </div>
              </dl>
              {error && (
                <p className="text-body-2-medium mt-3 text-[var(--color-text-error-primary)]">
                  {error}
                </p>
              )}
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
              description="Your currency conversion was completed successfully and both balances have been updated."
              details={[
                { label: "Amount converted", value: `${currency.symbol} ${Number(result?.source_amount || amount).toLocaleString("en", { maximumFractionDigits: 6 })} ${result?.source_currency_code || currency.code}`, emphasis: true },
                { label: "Amount received", value: `${target?.symbol || ""} ${Number(result?.destination_amount || convertedAmount).toLocaleString("en", { maximumFractionDigits: 6 })} ${result?.destination_currency_code || target?.code}`, emphasis: true },
                { label: "Exchange rate", value: formatExchangeRate(rates, currency.code, target?.code) },
                { label: "Status", value: "Completed" },
              ]}
              note="Your updated balances are available immediately."
              onDone={close}
              summary={`${result?.source_currency_code || currency.code} was converted directly into ${result?.destination_currency_code || target?.code}.`}
              summaryTitle="Currency conversion"
              title="Conversion complete"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
