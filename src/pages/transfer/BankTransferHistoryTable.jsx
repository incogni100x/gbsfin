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
  completed:
    "bg-[var(--color-state-success-base)] text-[var(--color-state-success-text)]",
  pending:
    "bg-[var(--color-status-yellow-background)] text-[var(--color-status-yellow-text)]",
  rejected:
    "bg-[var(--color-background-tertiary-error)] text-[var(--color-text-error-primary)]",
};

export default function BankTransferHistoryTable({ transfers }) {
  return (
    <Table
      aria-label="Bank transfer history"
      className="min-w-[860px]"
      containerClassName="overflow-x-auto overflow-y-hidden rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] touch-pan-x"
      size="md"
    >
      <TableHeader>
        <TableColumn isRowHeader>Reference</TableColumn>
        <TableColumn>Type</TableColumn>
        <TableColumn>Recipient</TableColumn>
        <TableColumn>Date</TableColumn>
        <TableColumn>Amount</TableColumn>
        <TableColumn>Status</TableColumn>
      </TableHeader>
      <TableBody
        items={transfers}
        renderEmptyState={() => (
          <div className="text-body-medium p-6 text-[var(--color-text-secondary)]">
            No bank transfers yet.
          </div>
        )}
      >
        {(transfer) => (
          <TableRow id={transfer.id}>
            <TableCell className="financial-number">
              {transfer.application_reference}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {transfer.transfer_type === "between_accounts"
                ? "Between accounts"
                : transfer.transfer_type === "international"
                  ? "International"
                  : "Domestic"}
            </TableCell>
            <TableCell>
              {transfer.recipient_name}
              <span className="text-body-2-medium block text-[var(--color-text-secondary)]">
                {transfer.recipient_bank_name} · ••••{" "}
                {transfer.recipient_account_number.slice(-4)}
              </span>
              {transfer.transfer_type !== "between_accounts" ? (
                <span className="financial-number text-body-2-medium block text-[var(--color-text-secondary)]">
                  {transfer.transfer_type === "international"
                    ? `SWIFT/BIC: ${transfer.recipient_swift_code || "—"}`
                    : `Routing: ${transfer.recipient_routing_number || "—"}`}
                </span>
              ) : null}
            </TableCell>
            <TableCell>
              {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
                new Date(transfer.created_at),
              )}
            </TableCell>
            <TableCell className="financial-number whitespace-nowrap">
              {transfer.amount.toLocaleString("en", {
                style: "currency",
                currency: transfer.currency_code,
              })}
            </TableCell>
            <TableCell>
              <Badge className={statusClassNames[transfer.status]}>
                {transfer.status[0].toUpperCase() + transfer.status.slice(1)}
              </Badge>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
