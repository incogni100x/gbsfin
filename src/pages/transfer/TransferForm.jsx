import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Radio, RadioGroup } from "@/components/base/radio/radio";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { currencies } from "@/pages/deposit/depositData.js";
import {
  convertCurrency,
  exchangeRatesQueryKey,
  formatExchangeRate,
  getExchangeRates,
} from "@/pages/deposit/exchangeRateService.js";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const bankAccounts = [
  {
    currency: "USD",
    number: "•••• 1492",
    id: "checking",
    name: "Checking account",
  },
  {
    currency: "USD",
    number: "•••• 7821",
    id: "savings",
    name: "Savings account",
  },
  {
    currency: "USD",
    number: "•••• 3108",
    id: "offshore",
    name: "Offshore account",
  },
];

const countries = [
  "Australia",
  "Canada",
  "Germany",
  "Mexico",
  "New Zealand",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
];

const selectClass =
  "text-body-medium mt-2 w-full rounded-[var(--radius-2lg)] border border-[var(--color-border-button-default)] bg-transparent px-3 py-2 text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus-ring)] focus:ring-1 focus:ring-[var(--color-border-focus-ring)]";

function TransferForm() {
  const availableCurrencies = currencies.filter((item) => item.isEnabled);
  const [amount, setAmount] = useState("100");
  const [destinationType, setDestinationType] = useState("account");
  const [international, setInternational] = useState({
    accountNumber: "",
    bankName: "",
    country: "",
    recipientName: "",
    swiftCode: "",
  });
  const [open, setOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [sourceCurrency, setSourceCurrency] = useState(
    availableCurrencies[0] ?? currencies[0],
  );
  const [step, setStep] = useState("review");
  const [targetCurrency, setTargetCurrency] = useState(null);
  const { data: exchangeRates } = useQuery({
    queryFn: getExchangeRates,
    queryKey: exchangeRatesQueryKey,
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (step !== "processing") return undefined;
    const timer = window.setTimeout(() => setStep("confirmation"), 1000);
    return () => window.clearTimeout(timer);
  }, [step]);

  const setInternationalField = (field, value) => {
    setInternational((details) => ({ ...details, [field]: value }));
  };

  const internationalIsComplete =
    international.accountNumber &&
    international.bankName &&
    international.country &&
    international.recipientName &&
    international.swiftCode &&
    targetCurrency;

  const destinationIsComplete =
    destinationType === "account"
      ? selectedAccount
      : destinationType === "currency"
        ? targetCurrency
        : internationalIsComplete;

  const destinationLabel =
    destinationType === "account"
      ? `${selectedAccount?.name ?? ""} · ${selectedAccount?.number ?? ""}`
      : destinationType === "currency"
        ? `${targetCurrency?.name ?? ""} balance`
        : `${international.recipientName} · ${international.bankName}`;
  const destinationCurrency =
    destinationType === "account"
      ? currencies.find((item) => item.code === selectedAccount?.currency)
      : targetCurrency;
  const receivedAmount = destinationCurrency
    ? convertCurrency(
        amount,
        exchangeRates,
        sourceCurrency.code,
        destinationCurrency.code,
      )
    : null;

  const changeDestinationType = (value) => {
    setDestinationType(value);
    setSelectedAccount(null);
    setTargetCurrency(null);
  };

  return (
    <>
      <LayerCard className="w-full !bg-[var(--color-background-primary-default)] text-[var(--color-text-primary)] ring-[var(--color-separator-border)]">
        <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3 text-[var(--color-text-secondary)] sm:p-4">
          <span className="text-title-3-medium sm:text-title-2-medium">
            New transfer
          </span>
        </LayerCard.Secondary>
        <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] p-4 ring-[var(--color-separator-border)] sm:p-5">
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              setStep("review");
              setOpen(true);
            }}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  className="text-body-medium block"
                  htmlFor="transfer-source"
                >
                  Transfer from
                </label>
                <select
                  className={selectClass}
                  id="transfer-source"
                  onChange={(event) =>
                    setSourceCurrency(
                      currencies.find(
                        (item) => item.code === event.target.value,
                      ) ?? currencies[0],
                    )
                  }
                  value={sourceCurrency.code}
                >
                  {availableCurrencies.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} balance — {item.symbol}
                      {item.balance}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Amount"
                leadingAddon={
                  <span className="text-body-medium shrink-0 pl-1 text-[var(--color-text-secondary)]">
                    {sourceCurrency.symbol}
                  </span>
                }
                onChange={setAmount}
                placeholder="0.00"
                value={amount}
              />
            </div>

            <fieldset>
              <legend className="text-body-medium">Transfer type</legend>
              <RadioGroup
                aria-label="Transfer type"
                className="mt-3 grid gap-3 md:grid-cols-3"
                onChange={changeDestinationType}
                value={destinationType}
              >
                {[
                  ["account", "Bank account"],
                  ["currency", "Currency balance"],
                  ["international", "International"],
                ].map(([value, label]) => (
                  <Radio
                    className="w-full rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-4 data-[selected]:border-[var(--color-accent-500)]"
                    key={value}
                    value={value}
                  >
                    {label}
                  </Radio>
                ))}
              </RadioGroup>
            </fieldset>

            {destinationType === "account" && (
              <div>
                <label className="text-body-medium block" htmlFor="bank-account">
                  Transfer to account
                </label>
                <select
                  className={selectClass}
                  id="bank-account"
                  onChange={(event) =>
                    setSelectedAccount(
                      bankAccounts.find(
                        (item) => item.id === event.target.value,
                      ) ?? null,
                    )
                  }
                  value={selectedAccount?.id ?? ""}
                >
                  <option value="">Select an account</option>
                  {bankAccounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.number}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {destinationType === "currency" && (
              <CurrencySelect
                id="currency-balance"
                label="Transfer to currency"
                onChange={setTargetCurrency}
                sourceCode={sourceCurrency.code}
                value={targetCurrency}
              />
            )}

            {destinationType === "international" && (
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  label="Recipient name"
                  onChange={(value) =>
                    setInternationalField("recipientName", value)
                  }
                  placeholder="Enter recipient name"
                  value={international.recipientName}
                />
                <div>
                  <label
                    className="text-body-medium block"
                    htmlFor="recipient-country"
                  >
                    Recipient country
                  </label>
                  <select
                    className={selectClass}
                    id="recipient-country"
                    onChange={(event) =>
                      setInternationalField("country", event.target.value)
                    }
                    value={international.country}
                  >
                    <option value="">Select country</option>
                    {countries.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Bank name"
                  onChange={(value) => setInternationalField("bankName", value)}
                  placeholder="Enter bank name"
                  value={international.bankName}
                />
                <Input
                  label="IBAN or account number"
                  onChange={(value) =>
                    setInternationalField("accountNumber", value)
                  }
                  placeholder="Enter account details"
                  value={international.accountNumber}
                />
                <Input
                  label="SWIFT/BIC code"
                  onChange={(value) =>
                    setInternationalField("swiftCode", value)
                  }
                  placeholder="Enter SWIFT code"
                  value={international.swiftCode}
                />
                <CurrencySelect
                  id="recipient-currency"
                  label="Recipient currency"
                  onChange={setTargetCurrency}
                  value={targetCurrency}
                />
              </div>
            )}

            <Button
              className="w-fit"
              disabled={!destinationIsComplete || !Number.parseFloat(amount)}
              type="submit"
            >
              Review transfer
            </Button>
          </form>
        </LayerCard.Primary>
      </LayerCard>

      <Dialog
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setStep("review");
        }}
        open={open}
      >
        <DialogContent aria-describedby={undefined}>
          {step === "review" && (
            <div>
              <DialogTitle>Review transfer</DialogTitle>
              <div className="mt-4 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-4">
                <dl className="financial-number text-body-2-medium grid gap-3">
                  <Detail label="From" value={`${sourceCurrency.name} balance`} />
                  <Detail
                    label="You send"
                    value={`${sourceCurrency.symbol} ${amount} ${sourceCurrency.code}`}
                  />
                  <Detail label="Transfer to" value={destinationLabel} />
                  {destinationType === "international" && (
                    <>
                      <Detail
                        label="Bank details"
                        value={`${international.accountNumber} · ${international.swiftCode}`}
                      />
                      <Detail
                        label="Destination country"
                        value={international.country}
                      />
                    </>
                  )}
                  {destinationCurrency && (
                    <>
                      <Detail
                        label="Indicative conversion rate"
                        value={formatExchangeRate(
                          exchangeRates,
                          sourceCurrency.code,
                          destinationCurrency.code,
                        )}
                      />
                      <Detail
                        label="Recipient receives"
                        value={`${destinationCurrency.symbol} ${
                          receivedAmount?.toFixed(2) ?? "—"
                        } ${destinationCurrency.code}`}
                      />
                    </>
                  )}
                </dl>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-3 [&_button]:w-full sm:flex-row sm:[&_button]:w-auto">
                <Button onClick={() => setOpen(false)} variant="secondary">
                  Back
                </Button>
                <Button onClick={() => setStep("processing")}>
                  Process transfer
                </Button>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="py-5 text-center">
              <Spinner className="mx-auto size-6 text-[var(--color-accent-600)]" />
              <DialogTitle className="mt-4">Processing transfer</DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Please wait while we process your transfer.
              </p>
              <Button className="mt-5" disabled>
                <Spinner />
                Processing
              </Button>
            </div>
          )}

          {step === "confirmation" && (
            <div className="py-3 text-center">
              <HugeiconsIcon
                aria-hidden="true"
                className="mx-auto text-[var(--color-accent-600)]"
                icon={CheckmarkCircle02Icon}
                size={40}
                strokeWidth={1.75}
              />
              <DialogTitle className="mt-3">Transfer complete</DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Your transfer to {destinationLabel} has been completed.
              </p>
              <div className="mt-5 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-4 text-left">
                <dl className="financial-number text-body-2-medium grid gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--color-text-secondary)]">Amount</dt>
                    <dd>
                      {sourceCurrency.symbol} {amount} {sourceCurrency.code}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-[var(--color-text-secondary)]">
                      Destination
                    </dt>
                    <dd className="text-right">{destinationLabel}</dd>
                  </div>
                  {destinationCurrency && (
                    <>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[var(--color-text-secondary)]">
                          Exchange rate
                        </dt>
                        <dd className="text-right">
                          {formatExchangeRate(
                            exchangeRates,
                            sourceCurrency.code,
                            destinationCurrency.code,
                          )}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-[var(--color-text-secondary)]">
                          Amount received
                        </dt>
                        <dd>
                          {destinationCurrency.symbol}{" "}
                          {receivedAmount?.toFixed(2) ?? "—"}{" "}
                          {destinationCurrency.code}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
              </div>
              <Button className="mt-5" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CurrencySelect({ id, label, onChange, sourceCode, value }) {
  return (
    <div>
      <label className="text-body-medium block" htmlFor={id}>
        {label}
      </label>
      <select
        className={selectClass}
        id={id}
        onChange={(event) =>
          onChange(
            currencies.find((item) => item.code === event.target.value) ?? null,
          )
        }
        value={value?.code ?? ""}
      >
        <option value="">Select currency</option>
        {currencies
          .filter((item) => item.code !== sourceCode)
          .map((item) => (
            <option key={item.code} value={item.code}>
              {item.code} — {item.name}
            </option>
          ))}
      </select>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-[var(--color-text-secondary)]">{label}</dt>
      <dd className="text-headline-medium mt-1">{value}</dd>
    </div>
  );
}

export default TransferForm;
