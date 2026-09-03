import { useAuth } from "@/auth/useAuth.js";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Radio, RadioGroup } from "@/components/base/radio/radio";
import { Select, SelectItem } from "@/components/base/select/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { userAccountsQueryKey } from "@/pages/dashboard/dashboardService.js";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { useState } from "react";
import { bankTransfersQueryKey, submitBankTransfer } from "./currencyTransferService.js";
import TransferConfirmation from "./TransferConfirmation.jsx";

export default function BankTransferDialog({ account, accounts, linkedAccounts }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("form");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState("own_account");
  const [destinationId, setDestinationId] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const mutation = useMutation({ mutationFn: submitBankTransfer });
  const ownAccounts = accounts.filter((item) => item.id !== account.id && item.currency === account.currency);
  const options = kind === "own_account" ? ownAccounts : linkedAccounts;
  const destination = options.find((item) => item.id === destinationId);
  const requiresApproval = kind === "linked_account" || account.name.toLowerCase() === "escrow" || destination?.name?.toLowerCase() === "escrow";
  const recipientLabel = destination ? kind === "own_account" ? `${destination.name} Account · •••• ${destination.accountNumber.slice(-4)}` : `${destination.account_name} · ${destination.bank_name}` : "";
  const canReview = Number(amount) > 0 && Number(amount) <= account.balance && destination;

  const close = () => { setOpen(false); setStep("form"); setAmount(""); setKind("own_account"); setDestinationId(null); setError(""); setResult(null); };
  const submit = async () => {
    setError(""); setStep("processing");
    try {
      const transfer = await mutation.mutateAsync({ amount, destinationId, destinationKind: kind, sourceAccountId: account.id });
      setResult(transfer);
      queryClient.setQueryData(userAccountsQueryKey(user.id), (items = []) => items.map((item) => {
        if (item.id === account.id) return { ...item, balance: item.balance - transfer.amount };
        if (transfer.status === "completed" && kind === "own_account" && item.id === destinationId) return { ...item, balance: item.balance + transfer.amount };
        return item;
      }));
      void queryClient.invalidateQueries({ queryKey: userAccountsQueryKey(user.id) });
      void queryClient.invalidateQueries({ queryKey: bankTransfersQueryKey(user.id) });
      void queryClient.invalidateQueries({ queryKey: ["transactions", user.id] });
      setStep("success");
    } catch (submissionError) { setError(submissionError.message || "Unable to complete this transfer."); setStep("review"); }
  };

  return <>
    <Button
      onClick={() => setOpen(true)}
      size="small"
      variant="secondary"
    >
      Transfer <HugeiconsIcon aria-hidden="true" icon={ArrowRight01Icon} size={16} strokeWidth={1.75} />
    </Button>
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent aria-describedby={undefined} className="sm:max-w-xl">
        {step === "form" && <div>
          <DialogTitle>Transfer from {account.name} Account</DialogTitle>
          <p className="text-body-2-medium mt-2 text-[var(--color-text-secondary)]">Choose another Global Stripe Fin account or one of your linked bank accounts.</p>
          <RadioGroup
            aria-label="Transfer type"
            className="mt-5 grid gap-3 sm:grid-cols-2"
            onChange={(value) => {
              setKind(value);
              setDestinationId(null);
            }}
            value={kind}
          >
            <Radio
              className="rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-600)]"
              value="own_account"
            >
              Between accounts
            </Radio>
            <Radio
              className="rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-3 data-[selected]:border-[var(--color-accent-600)]"
              value="linked_account"
            >
              Linked bank account
            </Radio>
          </RadioGroup>
          <Input className="mt-4" label="Amount" leadingAddon={<span className="text-body-medium pl-1 text-[var(--color-text-primary)]">{account.currency}</span>} min="0" max={account.balance} onChange={setAmount} placeholder="0.00" type="number" value={amount} />
          <div className="mt-4"><label className="text-body-medium mb-2 block" id={`recipient-${account.id}`}>{kind === "own_account" ? "To account" : "Linked bank account"}</label><Select aria-labelledby={`recipient-${account.id}`} onSelectionChange={(key) => setDestinationId(String(key))} placeholder="Select account" selectedKey={destinationId}>
            {options.map((item) => <SelectItem id={item.id} key={item.id}>{kind === "own_account" ? `${item.name} Account · •••• ${item.accountNumber.slice(-4)}` : `${item.account_name} · ${item.bank_name}`}</SelectItem>)}
          </Select></div>
          {kind === "linked_account" && linkedAccounts.length === 0 && <div className="mt-3"><p className="text-body-2-medium text-[var(--color-text-secondary)]">You have no linked bank accounts yet.</p><Link className="text-body-medium mt-2 inline-flex items-center gap-1 text-[var(--color-accent-700)] hover:underline" onClick={() => setOpen(false)} to="/manage-accounts">Manage linked accounts <HugeiconsIcon aria-hidden="true" icon={ArrowRight01Icon} size={16} /></Link></div>}
          {error && <p className="text-body-2-medium mt-3 text-[var(--color-text-error-primary)]">{error}</p>}
          <Button className="mt-5" disabled={!canReview} onClick={() => setStep("review")}>Review transfer</Button>
        </div>}
        {step === "review" && <div><DialogTitle>Review bank transfer</DialogTitle><dl className="text-body-2-medium mt-4 grid gap-3 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-4">
          <div><dt className="text-[var(--color-text-secondary)]">Amount</dt><dd className="text-headline-medium mt-1">{Number(amount).toLocaleString("en", { style: "currency", currency: account.currency })}</dd></div>
          <div><dt className="text-[var(--color-text-secondary)]">Recipient</dt><dd className="mt-1">{recipientLabel}</dd></div>
          <div><dt className="text-[var(--color-text-secondary)]">Processing</dt><dd className="mt-1">{requiresApproval ? "Pending approval" : "Completes immediately"}</dd></div>
        </dl>{requiresApproval && <p className="text-body-2-medium mt-3 text-[var(--color-status-yellow-text)]">The amount will be reserved until this bank transfer is approved or rejected.</p>}{error && <p className="text-body-2-medium mt-3 text-[var(--color-text-error-primary)]">{error}</p>}<div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row"><Button variant="secondary" onClick={() => setStep("form")}>Back</Button><Button onClick={submit}>Confirm transfer</Button></div></div>}
        {step === "processing" && <div className="py-6 text-center"><Spinner className="mx-auto size-6 text-[var(--color-accent-600)]" /><DialogTitle className="mt-4">Processing transfer</DialogTitle></div>}
        {step === "success" && <TransferConfirmation
          description={result?.status === "pending" ? "Your bank transfer was submitted and is awaiting approval." : "Your transfer between accounts was completed successfully."}
          details={[
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
        />}
      </DialogContent>
    </Dialog>
  </>;
}
