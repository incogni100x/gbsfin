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
  getLoanOptions,
  getLoans,
  loanKeys,
  requestLoan,
} from "./loanService.js";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
function StatCard({ detail, label, value }) {
  return (
    <LayerCard className="w-full !bg-[var(--color-background-primary-default)] ring-[var(--color-separator-border)]">
      <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3">
        <span className="text-body-medium">{label}</span>
      </LayerCard.Secondary>
      <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] px-4 py-3 ring-[var(--color-separator-border)]">
        <strong className="financial-number text-title-1-medium">{value}</strong>
        <span className="text-body-2-medium text-[var(--color-text-secondary)]">
          {detail}
        </span>
      </LayerCard.Primary>
    </LayerCard>
  );
}
function LoanTable({ loans, title }) {
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
          <TableColumn isRowHeader>Loan</TableColumn>
          <TableColumn>Amount</TableColumn>
          <TableColumn>Purpose</TableColumn>
          <TableColumn>Term</TableColumn>
          <TableColumn>Monthly payment</TableColumn>
          <TableColumn>Status</TableColumn>
        </TableHeader>
        <TableBody>
          {loans.length ? (
            loans.map((loan) => (
              <TableRow key={loan.id}>
                <TableCell>{loan.loan_types?.name}</TableCell>
                <TableCell>{money(loan.amount)}</TableCell>
                <TableCell>{loan.reason}</TableCell>
                <TableCell>{loan.duration_months} months</TableCell>
                <TableCell>{money(loan.monthly_payment)}</TableCell>
                <TableCell>
                  <Badge
                    color={loan.status === "active" ? "primary" : "neutral"}
                  >
                    {loan.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6}>
                <div className="py-8 text-center">
                  <span className="text-headline-medium">No records yet</span>
                  <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
                    Your loan requests will appear here.
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

export default function LoansPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [planId, setPlanId] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const {
    data: options = { types: [], plans: [], purposes: [], partners: [] },
    isPending: optionsPending,
  } = useQuery({
    queryKey: loanKeys.options,
    queryFn: getLoanOptions,
    staleTime: Infinity,
  });
  const { data: accounts = [], isPending: accountsPending } = useQuery({
    enabled: !!user?.id,
    queryKey: userAccountsQueryKey(user?.id),
    queryFn: getCurrentUserAccounts,
    staleTime: 30000,
  });
  const { data: loans = [], error, isPending: loansPending } = useQuery({
    enabled: !!user?.id,
    queryKey: loanKeys.all(user?.id),
    queryFn: () => getLoans(user.id),
    refetchInterval: 30000,
    staleTime: 15000,
  });
  const selectedType =
    options.types.find((item) => String(item.id) === String(typeId)) ||
    options.types[0];
  const availablePlans = options.plans.filter(
    (item) => String(item.loan_type_id) === String(selectedType?.id),
  );
  const selectedPlan = availablePlans.find(
    (item) => String(item.id) === String(planId),
  );
  const principal = Number(amount) || 0;
  const monthlyRate = (selectedPlan?.annual_interest_rate || 0) / 100 / 12;
  const monthlyPayment =
    principal && monthlyRate
      ? (principal *
          monthlyRate *
          (1 + monthlyRate) ** selectedPlan.duration_months) /
        ((1 + monthlyRate) ** selectedPlan.duration_months - 1)
      : 0;
  const purposes = selectedType?.is_investment
    ? options.partners
    : options.purposes;
  const request = useMutation({
    mutationFn: requestLoan,
    onSuccess: async () => {
      setConfirming(false);
      setAmount("");
      setReason("");
      setMessage("");
      setRequestSubmitted(true);
      await queryClient.invalidateQueries({ queryKey: loanKeys.all(user?.id) });
      await queryClient.invalidateQueries({ queryKey: ["transactions", user?.id] });
    },
    onError: (e) => setMessage(e.message),
  });
  const openConfirmation = (event) => {
    event.preventDefault();
    setMessage("");
    if (
      !principal ||
      !(accountId || accounts[0]?.id) ||
      !selectedType ||
      !selectedPlan
    )
      return setMessage(
        "Complete the amount, loan type, duration, and credit account.",
      );
    setReason("");
    setConfirming(true);
  };
  const active = loans.filter((loan) => loan.status === "active");
  const pending = loans.filter(
    (loan) => loan.status !== "active" && loan.status !== "completed",
  );
  if (optionsPending || accountsPending || loansPending) {
    return (
      <section>
        <PageHeader
          description="Request financing and track your active and pending loans."
          title="Loans"
        />
        <ContentSkeleton label="Loading loans" />
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        description="Request financing and track your active and pending loans."
        title="Loans"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Total Loan Amount"
          value={money(active.reduce((sum, l) => sum + l.remaining_balance, 0))}
          detail={`Across ${active.length} active loans`}
        />
        <StatCard
          label="Monthly Payment"
          value={money(active.reduce((sum, l) => sum + l.monthly_payment, 0))}
          detail="Total across all active loans"
        />
        <StatCard
          label="Overdue Balance"
          value={money(active.reduce((sum, l) => sum + l.overdue_amount, 0))}
          detail="Across active loans"
        />
      </div>
      <LayerCard className="mt-6 w-full !bg-[var(--color-background-primary-default)] ring-[var(--color-separator-border)]">
        <LayerCard.Secondary className="!bg-[var(--color-background-secondary-default)] px-4 py-3">
          <span className="text-title-3-medium sm:text-title-2-medium">
            Request a loan
          </span>
        </LayerCard.Secondary>
        <LayerCard.Primary className="!bg-[var(--color-background-primary-default)] p-4 ring-[var(--color-separator-border)] sm:p-5">
          <form className="grid gap-5" onSubmit={openConfirmation}>
            <div className="grid gap-5 md:grid-cols-3">
              <Input
                label="Requested amount"
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
                Loan type
                <Select
                  aria-label="Loan type"
                  selectedKey={String(typeId || selectedType?.id || "")}
                  onSelectionChange={(key) => {
                    setTypeId(String(key));
                    setPlanId("");
                    setReason("");
                  }}
                >
                  {options.types.map((type) => (
                    <SelectItem id={String(type.id)} key={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1 text-body-medium">
                Duration
                <Select
                  aria-label="Loan duration"
                  placeholder="Select a duration"
                  selectedKey={planId || null}
                  onSelectionChange={(key) => setPlanId(String(key))}
                >
                  {availablePlans.map((plan) => (
                    <SelectItem id={String(plan.id)} key={plan.id}>
                      <span className="grid text-left">
                        <span>{plan.duration_months} months</span>
                        <span className="text-body-2-medium text-[var(--color-text-secondary)]">
                          {plan.annual_interest_rate}% interest rate
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </Select>
              </label>
            </div>
            {selectedType?.is_investment && (
              <div className="rounded-[var(--radius-lg)] bg-[var(--color-background-secondary-default)] p-4">
                <span className="text-body-medium">Investment Loan</span>
                <p className="text-body-2-medium text-[var(--color-text-secondary)]">
                  This special loan is available only for our approved
                  investors, including Coinbase, CapiRocket, EliteMutual Fund,
                  and others.
                </p>
              </div>
            )}
            <fieldset>
              <legend className="text-body-medium">Account to credit</legend>
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
                          Current balance {money(account.balance)}
                        </span>
                      </span>
                    </Radio>
                  ))}
              </RadioGroup>
            </fieldset>
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-background-secondary-default)] p-4">
              <span className="text-[var(--color-text-secondary)]">
                Estimated monthly payment
              </span>{" "}
              <span className="financial-number text-body-medium">{money(monthlyPayment)}</span>
            </div>
            <FeedbackMessage tone="error">{message}</FeedbackMessage>
            <Button className="w-fit" type="submit">
              Continue request
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
        <LoanTable loans={active} title="Active loans" />
        <LoanTable loans={pending} title="Pending loans" />
      </div>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="gap-6 sm:max-w-lg sm:p-7">
          <DialogHeader className="gap-2 pr-6 text-left">
            <DialogTitle className="text-title-3-medium sm:text-title-2-medium">
              Confirm loan request
            </DialogTitle>
            <DialogDescription>
              Select the purpose for this loan before submitting it for review.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="grid gap-2">
            <legend className="text-body-medium">
              {selectedType?.is_investment
                ? "Investment partner"
                : "Purpose of loan"}
            </legend>
            <RadioGroup
              aria-label={
                selectedType?.is_investment
                  ? "Investment partner"
                  : "Purpose of loan"
              }
              className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
              onChange={setReason}
              value={reason}
            >
              {purposes.map((purpose) => (
                <Radio
                  className="w-full rounded-[var(--radius-lg)] border border-[var(--color-separator-border)] p-3"
                  key={purpose}
                  value={purpose}
                >
                  <span className="text-body-medium">{purpose}</span>
                </Radio>
              ))}
            </RadioGroup>
          </fieldset>
          <div className="financial-number grid gap-3 rounded-[var(--radius-lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-secondary-default)] p-4 sm:p-5">
            <span className="text-body-medium">
              {selectedType?.name} · {selectedPlan?.duration_months} months
            </span>
            <span className="financial-number text-title-3-medium">{money(principal)}</span>
            <span className="text-body-medium text-[var(--color-text-secondary)]">
              Estimated payment {money(monthlyPayment)} monthly
            </span>
          </div>
          {message && (
            <p className="text-body-medium text-[var(--color-text-error-primary)]">
              {message}
            </p>
          )}
          <DialogFooter className="gap-3 [&_button]:w-full sm:[&_button]:w-auto">
            <DialogClose render={<Button variant="secondary">Cancel</Button>} />
            <Button
              disabled={!reason || request.isPending}
              onClick={() =>
                request.mutate({
                  accountId:
                    accountId || accounts.find((a) => a.currency === "USD")?.id,
                  amount: principal,
                  loanTypeId: Number(typeId || selectedType.id),
                  planId: Number(planId || selectedPlan.id),
                  reason,
                })
              }
            >
              {request.isPending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={requestSubmitted} onOpenChange={setRequestSubmitted}>
        <DialogContent className="gap-6 sm:max-w-md sm:p-7">
          <DialogHeader className="gap-2 pr-6 text-left">
            <DialogTitle className="text-title-3-medium sm:text-title-2-medium">
              Loan request submitted
            </DialogTitle>
            <DialogDescription>
              Your request is pending review. You can follow its status in the pending loans table.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="[&_button]:w-full sm:[&_button]:w-auto">
            <DialogClose render={<Button>Done</Button>} />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
