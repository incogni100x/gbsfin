import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { useAuth } from "@/auth/useAuth.js";
import { Badge } from "@/components/base/badges/badge";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Radio, RadioGroup } from "@/components/base/radio/radio";
import { Select, SelectItem } from "@/components/base/select/select";
import ContentSkeleton from "@/components/ui/ContentSkeleton.jsx";
import FeedbackMessage from "@/components/ui/FeedbackMessage.jsx";
import PageHeader from "@/components/ui/PageHeader.jsx";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCurrentUserAccounts,
  userAccountsQueryKey,
} from "@/pages/dashboard/dashboardService.js";
import {
  fixedDepositKeys,
  getFixedDeposits,
  getFixedDepositRates,
  openFixedDeposit,
  requestFixedDepositClosure,
} from "./fixedDepositService.js";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
const activeStatuses = new Set([
  "active",
  "pending_closure",
  "processing",
  "rejected",
]);
const statusLabel = (status) =>
  status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());

function StatCard({ detail, label, value }) {
  return (
    <LayerCard className="w-full !bg-[var(--color-background-primary-default)] ring-[var(--color-separator-border)]">
      <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3">
        <span className="text-body-medium">{label}</span>
      </LayerCard.Secondary>
      <LayerCard.Primary className="!bg-[var(--color-accent-600)] px-4 py-3 text-[var(--color-neutral-50)] ring-[var(--color-separator-border)]">
        <strong className="financial-number text-title-1-medium">
          {value}
        </strong>
        <span className="text-body-2-medium text-[var(--color-neutral-50)]">
          {detail}
        </span>
      </LayerCard.Primary>
    </LayerCard>
  );
}

function DepositTable({ deposits, onClose, title }) {
  return (
    <section>
      <h2 className="text-title-3-medium mb-4 sm:text-title-2-medium">
        {title}
      </h2>
      <Table
        aria-label={title}
        containerClassName="overflow-x-auto rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] touch-pan-x"
        size="md"
      >
        <TableHeader>
          <TableColumn isRowHeader>Account</TableColumn>
          <TableColumn>Principal</TableColumn>
          <TableColumn>Interest</TableColumn>
          <TableColumn>Term</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Action</TableColumn>
        </TableHeader>
        <TableBody>
          {deposits.length ? (
            deposits.map((deposit) => (
              <TableRow key={deposit.id}>
                <TableCell>
                  {deposit.user_accounts?.account_types?.name || "Account"}{" "}
                  <span className="account-number">
                    •••• {deposit.user_accounts?.account_number?.slice(-4)}
                  </span>
                </TableCell>
                <TableCell>{money(deposit.amount)}</TableCell>
                <TableCell>{money(deposit.accruedProfit)}</TableCell>
                <TableCell>{deposit.duration_months} months</TableCell>
                <TableCell>
                  <Badge
                    color={deposit.status === "active" ? "primary" : "neutral"}
                  >
                    {statusLabel(deposit.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {["active", "rejected"].includes(deposit.status) &&
                  new Date(deposit.end_date) > new Date() ? (
                    <Button
                      onClick={() => onClose(deposit)}
                      size="small"
                      variant="secondary"
                    >
                      Close
                    </Button>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6}>
                <div className="py-8 text-center">
                  <span className="text-headline-medium">No records yet</span>
                  <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
                    Your fixed deposits will appear here.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}

export default function FixedDepositPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [rateId, setRateId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [closing, setClosing] = useState(null);
  const [closureConfirmation, setClosureConfirmation] = useState(null);
  const [confirmingDeposit, setConfirmingDeposit] = useState(false);
  const [depositConfirmation, setDepositConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const { data: rates = [], isPending: ratesPending } = useQuery({
    queryKey: fixedDepositKeys.rates,
    queryFn: getFixedDepositRates,
    staleTime: Infinity,
  });
  const { data: accounts = [], isPending: accountsPending } = useQuery({
    enabled: !!user?.id,
    queryKey: userAccountsQueryKey(user?.id),
    queryFn: getCurrentUserAccounts,
    staleTime: 30000,
  });
  const {
    data: deposits = [],
    error,
    isPending: depositsPending,
  } = useQuery({
    enabled: !!user?.id,
    queryKey: fixedDepositKeys.all(user?.id),
    queryFn: () => getFixedDeposits(user.id),
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const selectedRate = rates.find((rate) => String(rate.id) === String(rateId));
  const principal = Number(amount) || 0;
  const interest = selectedRate
    ? ((principal * selectedRate.monthly_rate) / 100) *
      selectedRate.duration_months
    : 0;
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: fixedDepositKeys.all(user?.id),
      }),
      queryClient.invalidateQueries({
        queryKey: userAccountsQueryKey(user?.id),
      }),
      queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] }),
    ]);
  };
  const create = useMutation({
    mutationFn: openFixedDeposit,
    onSuccess: async () => {
      setConfirmingDeposit(false);
      setDepositConfirmation(true);
      setAmount("");
      setMessage("");
      await refresh();
    },
    onError: (e) => setMessage(e.message),
  });
  const close = useMutation({
    mutationFn: (deposit) => requestFixedDepositClosure(deposit.id),
    onSuccess: async (_, deposit) => {
      setClosing(null);
      setClosureConfirmation(deposit);
      setMessage("");
      await refresh();
    },
    onError: (e) => setMessage(e.message),
  });
  const active = deposits.filter((item) => activeStatuses.has(item.status));
  const history = deposits.filter((item) => !activeStatuses.has(item.status));
  const totalPrincipal = active.reduce((sum, item) => sum + item.amount, 0);
  const totalInterest = deposits.reduce(
    (sum, item) => sum + item.accruedProfit,
    0,
  );
  const submit = (event) => {
    event.preventDefault();
    setMessage("");
    const resolvedAccount =
      accountId || accounts.find((a) => a.currency === "USD")?.id;
    if (!principal || !rateId || !resolvedAccount)
      return setMessage("Enter an amount, term, and funding account.");
    setConfirmingDeposit(true);
  };
  const penalty = (closing?.accruedProfit || 0) * 0.055;
  if (ratesPending || accountsPending || depositsPending) {
    return (
      <section>
        <PageHeader
          description="Grow your savings for a fixed term with a predictable return."
          title="Fixed deposits"
        />
        <ContentSkeleton label="Loading fixed deposits" />
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        description="Grow your savings for a fixed term with a predictable return."
        title="Fixed deposits"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total Principal"
          value={money(totalPrincipal)}
          detail={`Across ${active.length} deposits`}
        />
        <StatCard
          label="Interest Earned"
          value={money(totalInterest)}
          detail="Accrued to date"
        />
        <StatCard
          label="Active Deposits"
          value={String(active.length)}
          detail={active.length ? "Currently earning" : "No active deposits"}
        />
      </div>
      <LayerCard className="mt-6 w-full !bg-[var(--color-background-primary-default)] ring-[var(--color-separator-border)]">
        <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3">
          <span className="text-title-3-medium sm:text-title-2-medium">
            Open a fixed deposit
          </span>
        </LayerCard.Secondary>
        <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] p-4 ring-[var(--color-separator-border)] sm:p-5">
          <form className="grid gap-5" onSubmit={submit}>
            <div className="grid gap-5 md:grid-cols-2">
              <Input
                label="Deposit amount"
                leadingAddon={
                  <span className="pl-1 text-[var(--color-text-primary)]">
                    $
                  </span>
                }
                placeholder="0.00"
                inputMode="decimal"
                value={amount}
                onChange={setAmount}
              />
              <label className="grid gap-1 text-body-medium">
                Term
                <Select
                  aria-label="Fixed deposit term"
                  placeholder="Select a term"
                  selectedKey={rateId || null}
                  onSelectionChange={(key) => setRateId(String(key))}
                >
                  {rates.map((rate) => (
                    <SelectItem id={String(rate.id)} key={rate.id}>
                      <span className="grid text-left">
                        <span>{rate.duration_months} months</span>
                        <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                          {rate.monthly_rate}% per month
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </Select>
              </label>
            </div>
            <fieldset>
              <legend className="text-body-medium">
                Account to fund deposit
              </legend>
              <RadioGroup
                className="mt-3 grid gap-3 md:grid-cols-3"
                value={
                  accountId ||
                  accounts.find((a) => a.currency === "USD")?.id ||
                  ""
                }
                onChange={setAccountId}
              >
                {accounts
                  .filter((a) => a.currency === "USD")
                  .map((account) => (
                    <Radio
                      className="w-full rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] p-4"
                      key={account.id}
                      value={account.id}
                    >
                      <span className="grid">
                        <span className="text-body-medium">
                          {account.name} •••• {account.accountNumber.slice(-4)}
                        </span>
                        <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                          Available {money(account.balance)}
                        </span>
                      </span>
                    </Radio>
                  ))}
              </RadioGroup>
            </fieldset>
            <div className="grid gap-3 rounded-[var(--radius-2lg)] bg-[var(--color-background-secondary-default)] p-4">
              <h3 className="text-headline-medium">Expected returns</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <span>
                  Principal Amount
                  <br />
                  <span className="financial-number text-title-3-medium">
                    {money(principal)}
                  </span>
                </span>
                <span>
                  Interest Earned
                  <br />
                  <span className="financial-number text-title-3-medium">
                    {money(interest)}
                  </span>
                </span>
                <span>
                  Maturity Amount
                  <br />
                  <span className="financial-number text-title-3-medium">
                    {money(principal + interest)}
                  </span>
                </span>
              </div>
            </div>
            <FeedbackMessage tone="error">{message}</FeedbackMessage>
            <Button className="w-fit" disabled={create.isPending} type="submit">
              {create.isPending ? "Opening…" : "Open fixed deposit"}
            </Button>
          </form>
        </LayerCard.Primary>
      </LayerCard>
      {error && (
        <p className="mt-6 text-[var(--color-text-error-primary)]">
          {error.message}
        </p>
      )}
      <div className="mt-8 grid gap-8">
        <DepositTable
          deposits={active}
          onClose={setClosing}
          title="Active fixed deposits"
        />
        <DepositTable
          deposits={history}
          onClose={setClosing}
          title="Deposit history"
        />
      </div>
      <Dialog open={confirmingDeposit} onOpenChange={setConfirmingDeposit}>
        <DialogContent className="gap-6 sm:max-w-lg sm:p-7">
          <DialogHeader className="gap-2 pr-6 text-left">
            <DialogTitle className="text-title-3-medium sm:text-title-2-medium">
              Confirm fixed deposit
            </DialogTitle>
            <DialogDescription>
              Review the funding account, term, and expected return before
              opening this deposit.
            </DialogDescription>
          </DialogHeader>
          <div className="financial-number grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-secondary-default)] p-4 sm:p-5">
            <p className="flex justify-between gap-4">
              <span>Principal</span>
              <span>{money(principal)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span>Term</span>
              <span>{selectedRate?.duration_months} months</span>
            </p>
            <p className="flex justify-between gap-4">
              <span>Interest</span>
              <span>{money(interest)}</span>
            </p>
            <p className="flex justify-between gap-4 border-t border-[var(--color-separator-border)] pt-3 text-headline-medium">
              <span>Maturity amount</span>
              <span>{money(principal + interest)}</span>
            </p>
          </div>
          <DialogFooter className="gap-3 [&_button]:w-full sm:[&_button]:w-auto">
            <DialogClose render={<Button variant="secondary">Back</Button>} />
            <Button
              disabled={create.isPending}
              onClick={() =>
                create.mutate({
                  accountId:
                    accountId || accounts.find((a) => a.currency === "USD")?.id,
                  amount: principal,
                  rateId: Number(rateId),
                })
              }
            >
              {create.isPending ? "Opening…" : "Confirm and open"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={depositConfirmation} onOpenChange={setDepositConfirmation}>
        <DialogContent className="gap-6 sm:max-w-md sm:p-7">
          <DialogHeader className="gap-2 pr-6 text-left">
            <DialogTitle className="text-title-3-medium sm:text-title-2-medium">
              Fixed deposit opened
            </DialogTitle>
            <DialogDescription>
              Your fixed deposit is active and has started earning interest.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="[&_button]:w-full sm:[&_button]:w-auto">
            <DialogClose render={<Button>Done</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!closing}
        onOpenChange={(open) => !open && setClosing(null)}
      >
        <DialogContent className="gap-6 sm:max-w-lg sm:p-7">
          <DialogHeader className="gap-2 pr-6 text-left">
            <DialogTitle className="text-title-3-medium text-[var(--color-text-error-primary)] sm:text-title-2-medium">
              Close Fixed Deposit?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to close this fixed deposit before maturity?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-error-default)] bg-[var(--color-background-tertiary-error)] p-4 sm:p-5">
              <h3 className="text-body-medium text-[var(--color-text-error-primary)]">
                Early Closure Penalty
              </h3>
              <p className="text-body-medium mt-1 text-[var(--color-text-error-primary)]">
                A penalty of 5.5% will be applied to your earned interest.
              </p>
            </div>
            <div className="grid gap-3">
              <h3 className="text-body-medium">Closure Summary</h3>
              <p className="text-body-medium flex items-center justify-between gap-4">
                <span>Principal Amount</span>
                <span className="financial-number text-body-medium">
                  {money(closing?.amount)}
                </span>
              </p>
              <p className="text-body-medium flex items-center justify-between gap-4">
                <span>Interest Earned</span>
                <span className="financial-number text-body-medium">
                  {money(closing?.accruedProfit)}
                </span>
              </p>
              <p className="text-body-medium flex items-center justify-between gap-4 text-[var(--color-text-error-primary)]">
                <span>Penalty</span>
                <span className="financial-number text-body-medium">
                  -{money(penalty)}
                </span>
              </p>
              <p className="text-body-medium flex items-center justify-between gap-4 border-t border-[var(--color-separator-border)] pt-3">
                <span>Estimated payout</span>
                <span className="financial-number text-body-medium">
                  {money(
                    (closing?.amount || 0) +
                      (closing?.accruedProfit || 0) -
                      penalty,
                  )}
                </span>
              </p>
            </div>
          </div>
          <DialogFooter className="gap-3 [&_button]:w-full sm:[&_button]:w-auto">
            <DialogClose render={<Button variant="secondary">Cancel</Button>} />
            <Button
              disabled={close.isPending}
              onClick={() => close.mutate(closing)}
              variant="danger"
            >
              {close.isPending ? "Submitting…" : "Request closure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!closureConfirmation}
        onOpenChange={(open) => !open && setClosureConfirmation(null)}
      >
        <DialogContent className="gap-6 sm:max-w-lg sm:p-7">
          <DialogHeader className="gap-2 pr-6 text-left">
            <DialogTitle className="text-title-3-medium sm:text-title-2-medium">
              Closure Request Submitted
            </DialogTitle>
            <DialogDescription>
              Your fixed deposit closure request has been submitted and is
              pending approval.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5">
            <div>
              <h3 className="text-body-medium mb-3">Request Details</h3>
              <div className="financial-number grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-secondary-default)] p-4 sm:p-5">
                <p className="text-body-medium flex items-center justify-between gap-4">
                  <span>Principal</span>
                  <span className="text-body-medium">
                    {money(closureConfirmation?.amount)}
                  </span>
                </p>
                <p className="text-body-medium flex items-center justify-between gap-4">
                  <span>Total Profit</span>
                  <span className="text-body-medium">
                    {money(closureConfirmation?.accruedProfit)}
                  </span>
                </p>
                <p className="text-body-medium flex items-center justify-between gap-4 text-[var(--color-text-error-primary)]">
                  <span>Penalty (5.5%)</span>
                  <span className="text-body-medium">
                    -{money((closureConfirmation?.accruedProfit || 0) * 0.055)}
                  </span>
                </p>
                <p className="text-body-medium flex items-center justify-between gap-4 border-t border-[var(--color-separator-border)] pt-3">
                  <span>Total Payout</span>
                  <span className="text-body-medium">
                    {money(
                      (closureConfirmation?.amount || 0) +
                        (closureConfirmation?.accruedProfit || 0) -
                        (closureConfirmation?.accruedProfit || 0) * 0.055,
                    )}
                  </span>
                </p>
                <p className="text-body-medium flex items-center justify-between gap-4">
                  <span>Status</span>
                  <Badge color="neutral">Pending</Badge>
                </p>
              </div>
            </div>
            <p className="text-body-medium text-[var(--color-text-secondary)]">
              Closure request submitted. Contact{" "}
              <a
                className="text-[var(--color-accent-600)] hover:underline"
                href="mailto:payments@globalstripefin.com"
              >
                payments@globalstripefin.com
              </a>
            </p>
          </div>
          <DialogFooter className="[&_button]:w-full sm:[&_button]:w-auto">
            <DialogClose render={<Button>Done</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
