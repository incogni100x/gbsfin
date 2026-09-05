import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Radio, RadioGroup } from "@/components/base/radio/radio";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageHeader from "@/components/ui/PageHeader.jsx";
import { useAuth } from "@/auth/useAuth.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteLinkedAccount,
  getLinkedAccounts,
  linkedAccountsQueryKey,
  saveLinkedAccount,
} from "./linkedAccountsService.js";

const emptyAccount = {
  account_type: "personal",
  account_name: "",
  account_number: "",
  confirm_account_number: "",
  bank_name: "",
  routing_number: "",
};
const mask = (value) => `•••• ${value.slice(-4)}`;

function LinkedAccountsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyAccount);
  const accounts = useQuery({
    enabled: Boolean(user?.id),
    queryFn: getLinkedAccounts,
    queryKey: linkedAccountsQueryKey(user?.id),
  });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: linkedAccountsQueryKey(user?.id),
    });
  const save = useMutation({
    mutationFn: saveLinkedAccount,
    onSuccess: () => {
      refresh();
      setEditing(null);
      setIsDialogOpen(false);
    },
  });
  const remove = useMutation({
    mutationFn: deleteLinkedAccount,
    onSuccess: refresh,
  });
  const openForm = (account = null) => {
    setEditing(account);
    setForm(
      account
        ? {
            ...emptyAccount,
            ...account,
            confirm_account_number: account.account_number,
          }
        : emptyAccount,
    );
    setIsDialogOpen(true);
  };
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const accountNumbersMatch =
    Boolean(form.account_number.trim()) &&
    form.account_number.trim() === form.confirm_account_number.trim();
  const routingNumberComplete = Boolean(form.routing_number.trim());

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          description="Link external bank accounts for your account management records."
          title="Manage accounts"
        />
        <Button onClick={() => openForm()} size="small">
          Add account
        </Button>
      </div>
      {accounts.isPending ? (
        <p className="text-body-medium text-[var(--color-text-secondary)]">
          Loading linked accounts…
        </p>
      ) : accounts.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.data.map((account) => (
            <article
              className="rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] p-5"
              key={account.id}
            >
              <p className="text-title-3-semibold">{account.account_name}</p>
              <p className="text-body-medium mt-1 text-[var(--color-text-secondary)]">
                {account.bank_name} · {mask(account.account_number)}
              </p>
              <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
                {account.account_type === "business" ? "Business" : "Personal"} account
              </p>
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => openForm(account)}
                  size="small"
                  variant="secondary"
                >
                  Edit
                </Button>
                <Button
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(account.id)}
                  size="small"
                  variant="danger"
                >
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius-2lg)] border border-dashed border-[var(--color-separator-border)] p-6">
          <p className="text-title-3-semibold">No linked accounts yet</p>
          <p className="text-body-medium mt-1 text-[var(--color-text-secondary)]">
            Add an external bank account to manage its details here.
          </p>
        </div>
      )}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit linked account" : "Link a bank account"}
            </DialogTitle>
            <DialogDescription>
              Enter the bank details you want to keep linked to your profile.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            id="linked-account-form"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate({
                id: editing?.id,
                account_type: form.account_type,
                account_name: form.account_name.trim(),
                account_number: form.account_number.trim(),
                bank_name: form.bank_name.trim(),
                routing_number: form.routing_number.trim(),
              });
            }}
          >
            <fieldset className="sm:col-span-2">
              <legend className="text-body-medium text-[var(--color-text-primary)]">
                Account type
              </legend>
              <RadioGroup
                aria-label="Account type"
                className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2"
                onChange={(value) => update("account_type", value)}
                value={form.account_type}
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
              onChange={(value) => update("account_name", value)}
              placeholder="e.g. Main checking"
              required
              value={form.account_name}
            />
            <Input
              label="Bank name"
              onChange={(value) => update("bank_name", value)}
              placeholder="Bank name"
              required
              value={form.bank_name}
            />
            <Input
              label="Account number"
              inputMode="numeric"
              onChange={(value) => update("account_number", value)}
              placeholder="Account number"
              required
              value={form.account_number}
            />
            <Input
              hint={
                form.confirm_account_number && !accountNumbersMatch
                  ? "Account numbers do not match."
                  : undefined
              }
              inputMode="numeric"
              isInvalid={Boolean(
                form.confirm_account_number && !accountNumbersMatch,
              )}
              label="Confirm account number"
              onChange={(value) => update("confirm_account_number", value)}
              placeholder="Re-enter account number"
              required
              value={form.confirm_account_number}
            />
            <Input
              className="sm:col-span-2"
              label="Routing number"
              inputMode="numeric"
              onChange={(value) => update("routing_number", value)}
              placeholder="Routing number"
              required
              value={form.routing_number || ""}
            />
          </form>
          <DialogFooter>
            <Button
              onClick={() => {
                setIsDialogOpen(false);
                setEditing(null);
              }}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={
                save.isPending ||
                !accountNumbersMatch ||
                !routingNumberComplete
              }
              form="linked-account-form"
              type="submit"
            >
              {save.isPending ? "Saving…" : "Save account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default LinkedAccountsPage;
