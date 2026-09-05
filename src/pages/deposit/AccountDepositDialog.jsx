import { Button } from "@/components/base/buttons/button";
import { FileUpload } from "@/components/base/file-upload/file-upload";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { submitAccountDepositRequest } from "./depositService.js";

const methodContent = {
  cheque: {
    description:
      "Upload a clear image or PDF of your check for review before it is credited.",
    formTitle: "Make a Check Deposit",
    successDescription:
      "Your check has been submitted for review. We’ll notify you when it is approved.",
    successTitle: "Check Deposit submitted",
  },
  direct_deposit: {
    description:
      "Request account details from our deposit team for a direct deposit.",
    formTitle: "Request direct deposit",
    successDescription:
      "Contact our deposit team with your reference to receive the account details.",
    successTitle: "Direct deposit request submitted",
  },
  wire_ach: {
    description:
      "Use one of your linked bank accounts to request a Wire or ACH deposit.",
    formTitle: "Deposit by Wire / ACH",
    successDescription:
      "Your Wire / ACH deposit request is pending review. We’ll notify you when it is approved.",
    successTitle: "Deposit request submitted",
  },
};

const mask = (value) => `•••• ${value.slice(-4)}`;

function AccountDepositDialog({
  accounts,
  linkedAccounts,
  method,
  onSubmitted,
  trigger,
}) {
  const navigate = useNavigate();
  const content = methodContent[method];
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [chequeFile, setChequeFile] = useState(null);
  const [linkedBankAccountId, setLinkedBankAccountId] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState(null);
  const request = useMutation({
    mutationFn: submitAccountDepositRequest,
    onSuccess: async (data) => {
      setResult(Array.isArray(data) ? data[0] : data);
      await onSubmitted();
    },
  });

  const close = () => {
    setOpen(false);
    setAccountId("");
    setAmount("");
    setChequeFile(null);
    setLinkedBankAccountId("");
    setResult(null);
    request.reset();
  };

  const amountIsValid = Number(amount) > 0;
  const creditedAccount = accounts.find((account) => account.id === accountId);
  const linkedBankAccount = linkedAccounts.find(
    (account) => account.id === linkedBankAccountId,
  );
  const canSubmit =
    accountId &&
    amountIsValid &&
    (method !== "wire_ach" || linkedBankAccountId) &&
    (method !== "cheque" || chequeFile);

  return (
    <>
      <button
        aria-label={`${content.formTitle}. ${content.description}`}
        className="group w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:ring-offset-2"
        onClick={() => setOpen(true)}
        type="button"
      >
        {trigger}
      </button>
      <Dialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
        }}
        open={open}
      >
        <DialogContent aria-describedby={undefined} className="sm:max-w-lg">
          {result ? (
            <div className="py-2 text-center" role="status">
              <HugeiconsIcon
                aria-hidden="true"
                className="mx-auto text-[var(--color-accent-600)]"
                icon={CheckmarkCircle02Icon}
                size={40}
                strokeWidth={1.75}
              />
              <DialogTitle className="mt-4">{content.successTitle}</DialogTitle>
              <p className="text-body-medium mt-2 text-[var(--color-text-secondary)]">
                {content.successDescription}
              </p>

              <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-secondary-default)] p-4 text-left">
                <strong className="text-headline-medium">
                  {method === "wire_ach"
                    ? "Wire / ACH review"
                    : method === "cheque"
                      ? "Check Deposit verification"
                      : "Direct Deposit"}
                </strong>
                {method === "direct_deposit" ? (
                  <p className="text-body-medium mt-2 text-[var(--color-text-secondary)]">
                    Contact{" "}
                    <a
                      className="font-medium text-[var(--color-accent-700)] underline underline-offset-2"
                      href={`mailto:deposit@globalstripefin.com?subject=${encodeURIComponent(
                        `Direct deposit ${result.application_reference}`,
                      )}`}
                    >
                      deposit@globalstripefin.com
                    </a>{" "}
                    to receive the account details for your deposit.
                  </p>
                ) : method === "wire_ach" ? (
                  <p className="text-body-medium mt-2 text-[var(--color-text-secondary)]">
                    Your request from{" "}
                    {linkedBankAccount?.accountName ||
                      "your linked bank account"}
                    {linkedBankAccount?.accountNumber
                      ? ` ${mask(linkedBankAccount.accountNumber)}`
                      : ""}{" "}
                    will be reviewed before your account is credited.
                  </p>
                ) : (
                  <p className="text-body-medium mt-2 text-[var(--color-text-secondary)]">
                    {chequeFile?.name || "Your uploaded check"} will be
                    verified before the deposit is credited to your account.
                  </p>
                )}
              </div>

              <dl className="financial-number mt-4 grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-secondary-default)] p-4 text-left">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-body-medium text-[var(--color-text-secondary)]">
                    Deposit amount
                  </dt>
                  <dd className="text-headline-medium tabular-nums">
                    $
                    {Number(amount).toLocaleString("en", {
                      minimumFractionDigits: 2,
                    })}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-[var(--color-separator-border)] pt-3">
                  <dt className="text-body-medium text-[var(--color-text-secondary)]">
                    Account to credit
                  </dt>
                  <dd className="text-body-medium text-right">
                    {creditedAccount?.name || "Selected account"}
                    {creditedAccount?.accountNumber
                      ? ` · ${mask(creditedAccount.accountNumber)}`
                      : ""}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-[var(--color-separator-border)] pt-3">
                  <dt className="text-body-medium text-[var(--color-text-secondary)]">
                    Status
                  </dt>
                  <dd className="text-body-medium text-right">
                    Pending review
                  </dd>
                </div>
                <div className="border-t border-[var(--color-separator-border)] pt-3">
                  <dt className="text-body-2-medium text-[var(--color-text-secondary)]">
                    Reference
                  </dt>
                  <dd className="text-body-2-medium mt-1 break-all font-mono select-all">
                    {result.application_reference}
                  </dd>
                </div>
              </dl>
              <Button className="mt-5" onClick={close}>
                Done
              </Button>
            </div>
          ) : (
            <div>
              <DialogHeader>
                <DialogTitle>{content.formTitle}</DialogTitle>
                <DialogDescription>{content.description}</DialogDescription>
              </DialogHeader>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-1 text-body-medium">
                  Account to credit
                  <Select
                    aria-label="Account to credit"
                    placeholder="Select an account"
                    selectedKey={accountId || null}
                    onSelectionChange={(key) => setAccountId(String(key))}
                  >
                    {accounts.map((account) => (
                      <SelectItem id={account.id} key={account.id}>
                        {account.name} · {mask(account.accountNumber)}
                      </SelectItem>
                    ))}
                  </Select>
                </label>

                {method === "wire_ach" && (
                  <div>
                    {linkedAccounts.length ? (
                      <label className="grid gap-1 text-body-medium">
                        Linked bank account
                        <Select
                          aria-label="Linked bank account"
                          placeholder="Select a linked account"
                          selectedKey={linkedBankAccountId || null}
                          onSelectionChange={(key) =>
                            setLinkedBankAccountId(String(key))
                          }
                        >
                          {linkedAccounts.map((account) => (
                            <SelectItem id={account.id} key={account.id}>
                              {account.accountName} ·{" "}
                              {mask(account.accountNumber)}
                            </SelectItem>
                          ))}
                        </Select>
                      </label>
                    ) : (
                      <div className="rounded-[var(--radius-lg)] border border-[var(--color-separator-border)] p-4">
                        <p className="text-body-medium">
                          No linked bank account
                        </p>
                        <p className="text-body-2-regular mt-1 text-[var(--color-text-secondary)]">
                          Link an external bank account before requesting a Wire
                          or ACH deposit.
                        </p>
                        <Button
                          className="mt-3"
                          onClick={() => navigate("/manage-accounts")}
                          size="small"
                          variant="secondary"
                        >
                          Manage accounts
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <Input
                  label="Deposit amount"
                  leadingAddon={
                    <span className="text-body-medium pl-1 text-[var(--color-text-primary)]">
                      $
                    </span>
                  }
                  min="0.01"
                  onChange={setAmount}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={amount}
                />

                {method === "cheque" && (
                  <div>
                    <p className="text-body-medium mb-2">Check image</p>
                    <FileUpload
                      allowedExtensions={["jpg", "jpeg", "png", "pdf"]}
                      maxBytes={10 * 1024 * 1024}
                      onUploadComplete={setChequeFile}
                    />
                    {chequeFile && (
                      <p className="text-body-2-medium mt-2 text-[var(--color-state-success-text)]">
                        {chequeFile.name} is ready to submit.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
                <Button onClick={close} variant="secondary">
                  Cancel
                </Button>
                <Button
                  disabled={!canSubmit || request.isPending}
                  onClick={() =>
                    request.mutate({
                      accountId,
                      amount,
                      chequeFile,
                      linkedBankAccountId,
                      method,
                    })
                  }
                >
                  {request.isPending ? "Submitting…" : "Submit deposit"}
                </Button>
              </div>
              {request.error && (
                <p className="text-body-2-medium mt-3 text-[var(--color-text-error-primary)]">
                  {request.error.message || "Unable to submit this deposit."}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AccountDepositDialog;
