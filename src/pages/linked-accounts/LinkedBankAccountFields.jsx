import { Input } from "@/components/base/input/input";
import { Radio, RadioGroup } from "@/components/base/radio/radio";
import { linkedAccountNumbersMatch } from "./linkedAccountForm.js";

export default function LinkedBankAccountFields({
  account,
  isTransferScopeReadOnly = false,
  onChange,
  showTransferScope = true,
}) {
  const accountNumbersMatch = linkedAccountNumbersMatch(account);
  const isInternational = account.transfer_scope === "international";

  const changeTransferScope = (value) => {
    onChange("transfer_scope", value);
    onChange(value === "international" ? "routing_number" : "swift_code", "");
  };

  return (
    <>
      {showTransferScope && !isTransferScopeReadOnly ? (
        <fieldset className="sm:col-span-2">
          <legend className="text-body-medium text-[var(--color-text-primary)]">
            Transfer type
          </legend>
          <RadioGroup
            aria-label="Transfer type"
            className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2"
            onChange={changeTransferScope}
            value={account.transfer_scope}
          >
            <Radio
              className="min-h-11 rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-500)]"
              value="domestic"
            >
              Domestic
            </Radio>
            <Radio
              className="min-h-11 rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-500)]"
              value="international"
            >
              International
            </Radio>
          </RadioGroup>
        </fieldset>
      ) : null}

      <fieldset className="sm:col-span-2">
        <legend className="text-body-medium text-[var(--color-text-primary)]">
          Account type
        </legend>
        <RadioGroup
          aria-label="Account type"
          className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2"
          onChange={(value) => onChange("account_type", value)}
          value={account.account_type}
        >
          <Radio
            className="min-h-11 rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-500)]"
            value="personal"
          >
            Personal
          </Radio>
          <Radio
            className="min-h-11 rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-500)]"
            value="business"
          >
            Business
          </Radio>
        </RadioGroup>
      </fieldset>

      <Input
        label="Account name"
        onChange={(value) => onChange("account_name", value)}
        placeholder="e.g. Main checking"
        required
        value={account.account_name}
      />
      <Input
        label="Bank name"
        onChange={(value) => onChange("bank_name", value)}
        placeholder="Bank name"
        required
        value={account.bank_name}
      />
      <Input
        label="Account number"
        inputMode="numeric"
        onChange={(value) => onChange("account_number", value)}
        placeholder="Account number"
        required
        value={account.account_number}
      />
      <Input
        hint={
          account.confirm_account_number && !accountNumbersMatch
            ? "Account numbers do not match."
            : undefined
        }
        inputMode="numeric"
        isInvalid={Boolean(
          account.confirm_account_number && !accountNumbersMatch,
        )}
        label="Confirm account number"
        onChange={(value) => onChange("confirm_account_number", value)}
        placeholder="Re-enter account number"
        required
        value={account.confirm_account_number}
      />
      {isInternational ? (
        <Input
          hint="Enter the bank's SWIFT/BIC code."
          label="SWIFT/BIC code"
          onChange={(value) => onChange("swift_code", value.toUpperCase())}
          placeholder="e.g. BOFAUS3NXXX"
          required
          value={account.swift_code || ""}
        />
      ) : (
        <Input
          label="Routing number"
          inputMode="numeric"
          onChange={(value) => onChange("routing_number", value)}
          placeholder="Routing number"
          required
          value={account.routing_number || ""}
        />
      )}
      <Input
        label="Address"
        onChange={(value) => onChange("address", value)}
        placeholder="Account holder address"
        required
        value={account.address || ""}
      />
    </>
  );
}
