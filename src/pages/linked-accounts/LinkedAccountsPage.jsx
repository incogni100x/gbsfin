import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageHeader from "@/components/ui/PageHeader.jsx";
import FeedbackMessage from "@/components/ui/FeedbackMessage.jsx";
import { useAuth } from "@/auth/useAuth.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteLinkedAccount,
  getLinkedAccounts,
  linkedAccountsQueryKey,
  saveLinkedAccount,
} from "./linkedAccountsService.js";
import LinkedBankAccountFields from "./LinkedBankAccountFields.jsx";
import {
  createEmptyLinkedAccount,
  createLinkedAccountFormValue,
  getLinkedAccountValidationMessage,
  isLinkedAccountComplete,
  normalizeLinkedAccount,
} from "./linkedAccountForm.js";

const mask = (value) => `•••• ${String(value ?? "").slice(-4)}`;

function LinkedAccountsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState(() => createEmptyLinkedAccount());
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
    save.reset();
    setEditing(account);
    setForm(createLinkedAccountFormValue(account));
    setIsDialogOpen(true);
  };
  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const validationMessage = getLinkedAccountValidationMessage(form);
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
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-title-3-semibold">{account.account_name}</p>
                <Badge color="neutral" className="capitalize">
                  {account.transfer_scope}
                </Badge>
              </div>
              <p className="text-body-medium mt-1 text-[var(--color-text-secondary)]">
                {account.bank_name} · {mask(account.account_number)}
              </p>
              <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
                {account.account_type === "business" ? "Business" : "Personal"} account
              </p>
              <p className="financial-number text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
                {account.transfer_scope === "international"
                  ? `SWIFT/BIC: ${account.swift_code || "Required"}`
                  : `Routing: ${account.routing_number}`}
              </p>
              {account.address ? (
                <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
                  {account.address}
                </p>
              ) : null}
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
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
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
                ...normalizeLinkedAccount(form),
              });
            }}
          >
            <LinkedBankAccountFields
              account={form}
              isTransferScopeReadOnly={Boolean(editing)}
              onChange={update}
            />
            {editing && validationMessage ? (
              <div className="sm:col-span-2">
                <FeedbackMessage tone="error">
                  {validationMessage}
                </FeedbackMessage>
              </div>
            ) : null}
            {save.error ? (
              <div className="sm:col-span-2">
                <FeedbackMessage tone="error">
                  {save.error.message || "The linked account could not be saved."}
                </FeedbackMessage>
              </div>
            ) : null}
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
              disabled={save.isPending || !isLinkedAccountComplete(form)}
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
