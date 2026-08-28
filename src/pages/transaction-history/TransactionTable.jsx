import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@/components/base/table/table";
import { Badge } from "@/components/base/badges/badge";

const statusColors = {
  approved: "neutral",
  completed: "neutral",
  pending: "neutral",
  rejected: "neutral",
};

const statusClassNames = {
  approved:
    "bg-[var(--color-state-success-base)] text-[var(--color-state-success-text)]",
  completed:
    "bg-[var(--color-state-success-base)] text-[var(--color-state-success-text)]",
  rejected:
    "bg-[var(--color-background-tertiary-error)] text-[var(--color-text-error-primary)]",
};

function formatAmount(transaction) {
  return new Intl.NumberFormat("en-US", {
    currency: transaction.currency_code || "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(transaction.amount);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function TransactionTable({ transactions }) {
  if (!transactions.length) {
    return (
      <div className="grid min-h-40 place-items-center rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] p-6 text-center">
        <div>
          <h3 className="text-headline-medium text-[var(--color-text-primary)]">
            No transactions found
          </h3>
          <p className="text-body-2-medium mt-1 text-[var(--color-text-secondary)]">
            Completed account activity will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Table
      aria-label="Transaction history"
      className="transaction-table min-w-[900px]"
      containerClassName="overflow-x-auto overflow-y-hidden rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] touch-pan-x"
      size="md"
    >
      <TableHeader>
        <TableColumn isRowHeader>Description</TableColumn>
        <TableColumn>Date</TableColumn>
        <TableColumn>Account</TableColumn>
        <TableColumn>Type</TableColumn>
        <TableColumn>Status</TableColumn>
        <TableColumn className="text-right">Amount</TableColumn>
      </TableHeader>
      <TableBody items={transactions}>
        {(transaction) => (
          <TableRow id={transaction.id}>
            <TableCell>{transaction.description}</TableCell>
            <TableCell>{formatDate(transaction.created_at)}</TableCell>
            <TableCell>
              <span className="grid">
                <span>{transaction.accountName}</span>
                {transaction.accountNumber ? (
                  <span className="account-number text-body-2-medium text-[var(--color-text-secondary)]">
                    •••• {transaction.accountNumber.slice(-4)}
                  </span>
                ) : null}
              </span>
            </TableCell>
            <TableCell>
              <Badge color="neutral">{transaction.typeLabel}</Badge>
            </TableCell>
            <TableCell>
              <Badge
                className={statusClassNames[transaction.status]}
                color={statusColors[transaction.status] || "neutral"}
              >
                {(transaction.status || "completed").replace(/^./, (letter) =>
                  letter.toUpperCase(),
                )}
              </Badge>
            </TableCell>
            <TableCell
              className={`financial-number whitespace-nowrap text-right ${
                transaction.direction === "credit"
                  ? "text-[var(--color-state-success-text)]"
                  : "text-[var(--color-text-primary)]"
              }`}
            >
              {transaction.direction === "credit" ? "+" : "−"}
              {formatAmount(transaction)}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default TransactionTable;
