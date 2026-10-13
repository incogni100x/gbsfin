import { useAuth } from "@/auth/useAuth.js";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Radio, RadioGroup } from "@/components/base/radio/radio";
import { Select, SelectItem } from "@/components/base/select/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { userAccountsQueryKey } from "@/pages/dashboard/dashboardService.js";
import LinkedBankAccountFields from "@/pages/linked-accounts/LinkedBankAccountFields.jsx";
import {
  createEmptyLinkedAccount,
  isLinkedAccountComplete,
  normalizeLinkedAccount,
} from "@/pages/linked-accounts/linkedAccountForm.js";
import { linkedAccountsQueryKey } from "@/pages/linked-accounts/linkedAccountsService.js";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { useState } from "react";
import {
  bankTransfersQueryKey,
  createLinkedAccountAndSubmitBankTransfer,
  submitBankTransfer,
} from "./currencyTransferService.js";
import TransferConfirmation from "./TransferConfirmation.jsx";

const transferLabels = {
  between_accounts: "Between accounts",
  domestic: "Domestic transfer",
  international: "International transfer",
};

export default function BankTransferDialog({ account, accounts, linkedAccounts }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("form");
  const [amount, setAmount] = useState("");
  const [transferType, setTransferType] = useState("between_accounts");
  const [recipientMode, setRecipientMode] = useState("saved");
  const [destinationId, setDestinationId] = useState(null);
  const [newAccount, setNewAccount] = useState(() =>
    createEmptyLinkedAccount("domestic"),
  );
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const mutation = useMutation({
    mutationFn: async () => {
      if (transferType === "between_accounts" || recipientMode === "saved") {
        return submitBankTransfer({
          amount,
          destinationId,
          destinationKind:
            transferType === "between_accounts" ? "own_account" : "linked_account",
          sourceAccountId: account.id,
        });
      }

      return createLinkedAccountAndSubmitBankTransfer({
        account: normalizeLinkedAccount(newAccount),
        amount,
        sourceAccountId: account.id,
        transferType,
      });
    },
  });

  const isExternal = transferType !== "between_accounts";
  const isInternationalAvailable = account.currency === "USD";
  const ownAccounts = accounts.filter(
    (item) => item.id !== account.id && item.currency === account.currency,
  );
  const savedRecipients = linkedAccounts.filter(
    (item) => (item.transfer_scope || "domestic") === transferType,
  );
  const options = isExternal ? savedRecipients : ownAccounts;
  const destination = options.find((item) => item.id === destinationId);
  const destinationIsEscrow =
    !isExternal && destination?.name?.trim().toLowerCase() === "escrow";
  const requiresApproval =
    isExternal ||
    account.name.trim().toLowerCase() === "escrow" ||
    destinationIsEscrow;
  const recipientLabel = isExternal
    ? recipientMode === "new"
      ? `${newAccount.account_name} · ${newAccount.bank_name}`
      : destination
        ? `${destination.account_name} · ${destination.bank_name}`
        : ""
    : destination
      ? `${destination.name} Account · •••• ${destination.accountNumber.slice(-4)}`
      : "";
  const amountIsValid =
    Number(amount) > 0 && Number(amount) <= Number(account.balance);
  const recipientIsValid = isExternal
    ? recipientMode === "new"
      ? isLinkedAccountComplete(newAccount)
      : Boolean(destination)
    : Boolean(destination);
  const canReview =
    amountIsValid &&
    recipientIsValid &&
    (transferType !== "international" || isInternationalAvailable);

  const updateNewAccount = (key, value) =>
    setNewAccount((current) => ({ ...current, [key]: value }));

  const changeTransferType = (value) => {
    setTransferType(value);
    setDestinationId(null);
    setRecipientMode("saved");
    setNewAccount(
      createEmptyLinkedAccount(value === "international" ? value : "domestic"),
    );
  };

  const close = () => {
    setOpen(false);
    setStep("form");
    setAmount("");
    setTransferType("between_accounts");
    setRecipientMode("saved");
    setDestinationId(null);
    setNewAccount(createEmptyLinkedAccount());
    setError("");
    setResult(null);
  };

  const submit = async () => {
    setError("");
    setStep("processing");
    try {
      const transfer = await mutation.mutateAsync();
      setResult(transfer);
      queryClient.setQueryData(userAccountsQueryKey(user.id), (items = []) =>
        items.map((item) => {
          if (item.id === account.id) {
            return { ...item, balance: item.balance - transfer.amount };
          }
          if (
            transfer.status === "completed" &&
            transferType === "between_accounts" &&
            item.id === destinationId
          ) {
            return { ...item, balance: item.balance + transfer.amount };
          }
          return item;
        }),
      );
      void queryClient.invalidateQueries({ queryKey: userAccountsQueryKey(user.id) });
      void queryClient.invalidateQueries({ queryKey: bankTransfersQueryKey(user.id) });
      void queryClient.invalidateQueries({ queryKey: linkedAccountsQueryKey(user.id) });
      void queryClient.invalidateQueries({ queryKey: ["transactions", user.id] });
      setStep("success");
    } catch (submissionError) {
      setError(submissionError.message || "Unable to complete this transfer.");
      setStep("review");
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} size="small" variant="secondary">
        Transfer
        <HugeiconsIcon
          aria-hidden="true"
          icon={ArrowRight01Icon}
          size={16}
          strokeWidth={1.75}
        />
      </Button>
      <Dialog open={open} onOpenChange={(next) => !next && close()}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl"
        >
          {step === "form" ? (
            <div>
              <DialogTitle>Transfer from {account.name} Account</DialogTitle>
              <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                Move money between your accounts or send it to a domestic or
                international bank account.
              </p>
              <RadioGroup
                aria-label="Transfer type"
                className="mt-5 grid gap-3 sm:grid-cols-3"
                onChange={changeTransferType}
                value={transferType}
              >
                <Radio className="min-h-11 rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-600)]" value="between_accounts">
                  Between accounts
                </Radio>
                <Radio className="min-h-11 rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-600)]" value="domestic">
                  Domestic
                </Radio>
                <Radio className="min-h-11 rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-600)]" isDisabled={!isInternationalAvailable} value="international">
                  International
                </Radio>
              </RadioGroup>
              {!isInternationalAvailable ? (
                <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">
                  International transfers are available only from USD bank accounts.
                </p>
              ) : null}

              <Input
                className="mt-4"
                label="Amount"
                leadingAddon={<span className="text-body-medium pl-1 text-[var(--color-text-primary)]">{account.currency}</span>}
                min="0"
                max={account.balance}
                onChange={setAmount}
                placeholder="0.00"
                type="number"
                value={amount}
              />

              {isExternal ? (
                <div className="mt-4">
                  <fieldset>
                    <legend className="text-body-medium text-[var(--color-text-primary)]">Recipient</legend>
                    <RadioGroup
                      aria-label="Recipient source"
                      className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2"
                      onChange={(value) => {
                        setRecipientMode(value);
                        setDestinationId(null);
                      }}
                      value={recipientMode}
                    >
                      <Radio className="min-h-11 rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-600)]" value="saved">
                        Saved account
                      </Radio>
                      <Radio className="min-h-11 rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-600)]" value="new">
                        Add new account
                      </Radio>
                    </RadioGroup>
                  </fieldset>

                  {recipientMode === "saved" ? (
                    savedRecipients.length ? (
                      <div className="mt-4">
                        <label className="text-body-medium mb-2 block" id={`recipient-${account.id}`}>
                          {transferLabels[transferType]} recipient
                        </label>
                        <Select
                          aria-labelledby={`recipient-${account.id}`}
                          onSelectionChange={(key) => setDestinationId(String(key))}
                          placeholder="Select linked account"
                          selectedKey={destinationId}
                        >
                          {savedRecipients.map((item) => (
                            <SelectItem id={item.id} key={item.id}>
                              {item.account_name} · {item.bank_name}
                            </SelectItem>
                          ))}
                        </Select>
                      </div>
                    ) : (
                      <div className="mt-3">
                        <p className="text-body-2-medium text-[var(--color-text-secondary)]">
                          No saved {transferType} accounts yet. Add one here or manage your linked accounts.
                        </p>
                        <Link className="text-body-medium mt-2 inline-flex min-h-8 items-center gap-1 text-[var(--color-accent-700)] underline-offset-4 hover:underline" onClick={() => setOpen(false)} to="/manage-accounts">
                          Manage linked accounts
                          <HugeiconsIcon aria-hidden="true" icon={ArrowRight01Icon} size={16} />
                        </Link>
                      </div>
                    )
                  ) : (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <LinkedBankAccountFields account={newAccount} onChange={updateNewAccount} showTransferScope={false} />
                      <p className="text-body-2-medium sm:col-span-2 text-[var(--color-text-secondary)]">
                        This recipient will be saved to Manage accounts after the transfer is submitted.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4">
                  <label className="text-body-medium mb-2 block" id={`recipient-${account.id}`}>To account</label>
                  <Select
                    aria-labelledby={`recipient-${account.id}`}
                    onSelectionChange={(key) => setDestinationId(String(key))}
                    placeholder="Select account"
                    selectedKey={destinationId}
                  >
                    {ownAccounts.map((item) => (
                      <SelectItem id={item.id} key={item.id}>
                        {item.name} Account · •••• {item.accountNumber.slice(-4)}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              )}

              {error ? <p className="text-body-2-medium mt-3 text-[var(--color-text-error-primary)]">{error}</p> : null}
              <Button className="mt-5" disabled={!canReview} onClick={() => setStep("review")}>
                Review transfer
              </Button>
            </div>
          ) : null}

          {step === "review" ? (
            <div>
              <DialogTitle>Review bank transfer</DialogTitle>
              <dl className="text-body-2-medium mt-4 grid gap-3 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-4">
                <div><dt className="text-[var(--color-text-secondary)]">Transfer type</dt><dd className="mt-1">{transferLabels[transferType]}</dd></div>
                <div><dt className="text-[var(--color-text-secondary)]">Amount</dt><dd className="financial-number text-headline-medium mt-1">{Number(amount).toLocaleString("en", { style: "currency", currency: account.currency })}</dd></div>
                <div><dt className="text-[var(--color-text-secondary)]">Recipient</dt><dd className="mt-1">{recipientLabel}</dd></div>
                <div><dt className="text-[var(--color-text-secondary)]">Processing</dt><dd className="mt-1">{requiresApproval ? "Pending approval" : "Completes immediately"}</dd></div>
              </dl>
              {requiresApproval ? <p className="text-body-2-medium mt-3 text-[var(--color-status-yellow-text)]">The amount will be reserved until this bank transfer is approved or rejected.</p> : null}
              {error ? <p className="text-body-2-medium mt-3 text-[var(--color-text-error-primary)]">{error}</p> : null}
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
                <Button variant="secondary" onClick={() => setStep("form")}>Back</Button>
                <Button onClick={submit}>Confirm transfer</Button>
              </div>
            </div>
          ) : null}

          {step === "processing" ? (
            <div className="py-6 text-center">
              <Spinner className="mx-auto size-6 text-[var(--color-accent-600)]" />
              <DialogTitle className="mt-4">Processing transfer</DialogTitle>
            </div>
          ) : null}

          {step === "success" ? (
            <TransferConfirmation
              description={result?.status === "pending" ? "Your bank transfer was submitted and is awaiting approval." : "Your transfer between accounts was completed successfully."}
              details={[
                { label: "Transfer type", value: transferLabels[transferType] },
                { label: "Transfer amount", value: Number(result?.amount || amount).toLocaleString("en", { style: "currency", currency: account.currency }), emphasis: true },
                { label: "Recipient", value: recipientLabel },
                { label: "Status", value: result?.status === "pending" ? "Pending review" : "Completed" },
                { label: "Reference", value: result?.application_reference, mono: true },
              ]}
              note={result?.status === "pending" ? "We’ll notify you when this transfer has been reviewed." : "The balances have been updated."}
              onDone={close}
              summary={result?.status === "pending" ? "The amount has been reserved from your source account until the request is approved or rejected." : "The amount was debited from the source account and credited to the receiving account."}
              summaryTitle={result?.status === "pending" ? "Transfer review" : "Transfer completed"}
              title={result?.status === "pending" ? "Transfer submitted" : "Transfer complete"}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
