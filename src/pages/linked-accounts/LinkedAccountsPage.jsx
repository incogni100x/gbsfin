import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "@/components/ui/PageHeader.jsx";
import { useAuth } from "@/auth/useAuth.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteLinkedAccount, getLinkedAccounts, linkedAccountsQueryKey, saveLinkedAccount } from "./linkedAccountsService.js";

const emptyAccount = { account_name: "", account_holder_name: "", account_number: "", bank_name: "", country_code: "US", currency_code: "USD", iban: "", routing_number: "", swift_code: "" };
const mask = (value) => `•••• ${value.slice(-4)}`;

function LinkedAccountsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyAccount);
  const accounts = useQuery({ enabled: Boolean(user?.id), queryFn: getLinkedAccounts, queryKey: linkedAccountsQueryKey(user?.id) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: linkedAccountsQueryKey(user?.id) });
  const save = useMutation({ mutationFn: saveLinkedAccount, onSuccess: () => { refresh(); setEditing(null); setIsDialogOpen(false); } });
  const remove = useMutation({ mutationFn: deleteLinkedAccount, onSuccess: refresh });
  const openForm = (account = null) => { setEditing(account); setForm(account ? { ...account } : emptyAccount); setIsDialogOpen(true); };
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return <section>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <PageHeader description="Link external bank accounts for your account management records." title="Manage accounts" />
      <Button onClick={() => openForm()} size="small">Add account</Button>
    </div>
    {accounts.isPending ? <p className="text-body-medium text-[var(--color-text-secondary)]">Loading linked accounts…</p> : accounts.data?.length ? (
      <div className="grid gap-4 md:grid-cols-2">
        {accounts.data.map((account) => <article className="rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] p-5" key={account.id}>
          <p className="text-title-3-semibold">{account.account_name}</p>
          <p className="text-body-medium mt-1 text-[var(--color-text-secondary)]">{account.bank_name} · {mask(account.account_number)}</p>
          <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">{account.account_holder_name} · {account.currency_code}</p>
          <div className="mt-4 flex gap-2"><Button onClick={() => openForm(account)} size="small" variant="secondary">Edit</Button><Button disabled={remove.isPending} onClick={() => remove.mutate(account.id)} size="small" variant="danger">Remove</Button></div>
        </article>)}
      </div>
    ) : <div className="rounded-[var(--radius-2lg)] border border-dashed border-[var(--color-separator-border)] p-6"><p className="text-title-3-semibold">No linked accounts yet</p><p className="text-body-medium mt-1 text-[var(--color-text-secondary)]">Add an external bank account to manage its details here.</p></div>}
    <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditing(null); }}>
      <DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{editing ? "Edit linked account" : "Link a bank account"}</DialogTitle><DialogDescription>Enter the bank details you want to keep linked to your profile.</DialogDescription></DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" id="linked-account-form" onSubmit={(event) => { event.preventDefault(); save.mutate({ ...form, id: editing?.id, account_name: form.account_name.trim(), account_holder_name: form.account_holder_name.trim(), account_number: form.account_number.trim(), bank_name: form.bank_name.trim(), country_code: form.country_code.trim().toUpperCase(), currency_code: form.currency_code.trim().toUpperCase(), iban: form.iban.trim() || null, routing_number: form.routing_number.trim() || null, swift_code: form.swift_code.trim() || null }); }}>
          <Input label="Account label" onChange={(value) => update("account_name", value)} placeholder="e.g. Personal checking" required value={form.account_name} />
          <Input label="Account holder" onChange={(value) => update("account_holder_name", value)} placeholder="Full name" required value={form.account_holder_name} />
          <Input label="Bank name" onChange={(value) => update("bank_name", value)} placeholder="Bank name" required value={form.bank_name} />
          <Input label="Account number" onChange={(value) => update("account_number", value)} placeholder="Account number" required value={form.account_number} />
          <Input label="Routing number (optional)" onChange={(value) => update("routing_number", value)} value={form.routing_number || ""} />
          <Input label="IBAN (optional)" onChange={(value) => update("iban", value)} value={form.iban || ""} />
          <Input className="sm:col-span-2" label="SWIFT / BIC (optional)" onChange={(value) => update("swift_code", value)} value={form.swift_code || ""} />
        </form>
        <DialogFooter><Button onClick={() => { setIsDialogOpen(false); setEditing(null); }} variant="secondary">Cancel</Button><Button disabled={save.isPending} form="linked-account-form" type="submit">{save.isPending ? "Saving…" : "Save account"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}

export default LinkedAccountsPage;
