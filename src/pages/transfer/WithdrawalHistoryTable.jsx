import { Badge } from "@/components/base/badges/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";

const statusClassNames = {
  approved:
    "bg-[var(--color-state-success-base)] text-[var(--color-state-success-text)]",
  pending:
    "bg-[var(--color-status-yellow-background)] text-[var(--color-status-yellow-text)]",
  rejected:
    "bg-[var(--color-background-tertiary-error)] text-[var(--color-text-error-primary)]",
};

function destinationLabel(withdrawal) {
  if (withdrawal.wallet_address) {
    return `${withdrawal.network} · ${withdrawal.wallet_address.slice(0, 8)}…${withdrawal.wallet_address.slice(-5)}`;
  }

  const account = withdrawal.account_number
    ? ` · •••• ${withdrawal.account_number.slice(-4)}`
    : withdrawal.iban
      ? ` · •••• ${withdrawal.iban.slice(-4)}`
      : "";

  return `${withdrawal.bank_name || "Bank account"}${account}`;
}

function WithdrawalHistoryTable({ withdrawals }) {
  return (
    <Table
      aria-label="Currency withdrawal requests"
      className="min-w-[720px]"
      containerClassName="overflow-x-auto overflow-y-hidden rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] touch-pan-x"
      size="md"
    >
      <TableHeader>
        <TableColumn isRowHeader>Currency</TableColumn>
        <TableColumn>Destination</TableColumn>
        <TableColumn>Submitted</TableColumn>
        <TableColumn>Amount</TableColumn>
        <TableColumn>Status</TableColumn>
      </TableHeader>
      <TableBody
        items={withdrawals}
        renderEmptyState={() => (
          <div className="text-body-medium p-6 text-[var(--color-text-secondary)]">
            No withdrawal requests yet.
          </div>
        )}
      >
        {(withdrawal) => (
          <TableRow id={withdrawal.id}>
            <TableCell>{withdrawal.currency_code}</TableCell>
            <TableCell>{destinationLabel(withdrawal)}</TableCell>
            <TableCell>
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
              }).format(new Date(withdrawal.created_at))}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {withdrawal.amount.toLocaleString("en", {
                maximumFractionDigits: 6,
              })}{" "}
              {withdrawal.currency_code}
            </TableCell>
            <TableCell>
              <Badge className={statusClassNames[withdrawal.status]}>
                {withdrawal.status[0].toUpperCase() +
                  withdrawal.status.slice(1)}
              </Badge>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default WithdrawalHistoryTable;
