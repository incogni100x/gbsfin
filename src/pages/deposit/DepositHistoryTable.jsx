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

function DepositHistoryTable({ deposits }) {
  return (
    <Table
      aria-label="Deposit confirmations"
      className="min-w-[680px]"
      containerClassName="overflow-x-auto overflow-y-hidden rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] touch-pan-x"
      size="md"
    >
      <TableHeader>
        <TableColumn isRowHeader>Account</TableColumn>
        <TableColumn>Method</TableColumn>
        <TableColumn>Submitted</TableColumn>
        <TableColumn>Amount</TableColumn>
        <TableColumn>Status</TableColumn>
      </TableHeader>
      <TableBody
        items={deposits}
        renderEmptyState={() => (
          <div className="text-body-medium p-6 text-[var(--color-text-secondary)]">
            No deposit confirmations yet.
          </div>
        )}
      >
        {(deposit) => (
          <TableRow id={deposit.id}>
            <TableCell>
              <span className="grid">
                <span>{deposit.accountName}</span>
                {deposit.accountNumber && (
                  <span className="text-body-2-regular text-[var(--color-text-secondary)]">
                    •••• {deposit.accountNumber.slice(-4)}
                  </span>
                )}
              </span>
            </TableCell>
            <TableCell>{deposit.method}</TableCell>
            <TableCell>
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
              }).format(new Date(deposit.createdAt))}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {Number(deposit.amount).toLocaleString("en", {
                maximumFractionDigits: 6,
              })}{" "}
              {deposit.currency}
            </TableCell>
            <TableCell>
              <Badge className={statusClassNames[deposit.status]}>
                {deposit.status[0].toUpperCase() + deposit.status.slice(1)}
              </Badge>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default DepositHistoryTable;
