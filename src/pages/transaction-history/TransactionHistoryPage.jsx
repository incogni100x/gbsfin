import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/useAuth.js";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { Select, SelectItem } from "@/components/base/select/select";
import ContentSkeleton from "@/components/ui/ContentSkeleton.jsx";
import FeedbackMessage from "@/components/ui/FeedbackMessage.jsx";
import PageHeader from "@/components/ui/PageHeader.jsx";
import TransactionTable from "./TransactionTable.jsx";
import { getTransactions, transactionsQueryKey } from "./transactionService.js";

const PAGE_SIZE = 10;

function TransactionHistoryPage() {
  const { user } = useAuth();
  const [date, setDate] = useState("");
  const [direction, setDirection] = useState("all");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const {
    data: transactions = [],
    error,
    isPending,
  } = useQuery({
    enabled: Boolean(user?.id),
    queryFn: () => getTransactions(user.id),
    queryKey: transactionsQueryKey(user?.id),
    staleTime: 30 * 1000,
  });

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesSearch =
        !normalizedSearch ||
        transaction.description.toLowerCase().includes(normalizedSearch) ||
        transaction.typeLabel.toLowerCase().includes(normalizedSearch) ||
        transaction.accountName.toLowerCase().includes(normalizedSearch);
      const matchesDirection =
        direction === "all" || transaction.direction === direction;
      const matchesStatus = status === "all" || transaction.status === status;
      const matchesDate = !date || transaction.created_at.slice(0, 10) === date;
      return matchesSearch && matchesDirection && matchesStatus && matchesDate;
    });
  }, [date, direction, search, status, transactions]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredTransactions.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const updateFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <section>
      <PageHeader
        description="Search and review activity across your bank accounts."
        title="Transaction history"
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          aria-label="Search transactions"
          onChange={updateFilter(setSearch)}
          placeholder="Search transactions"
          value={search}
        />
        <Select
          aria-label="Filter by transaction direction"
          onSelectionChange={(key) => updateFilter(setDirection)(String(key))}
          selectedKey={direction}
        >
          <SelectItem id="all">All activity</SelectItem>
          <SelectItem id="credit">Credits</SelectItem>
          <SelectItem id="debit">Debits</SelectItem>
        </Select>
        <Select
          aria-label="Filter by transaction status"
          onSelectionChange={(key) => updateFilter(setStatus)(String(key))}
          selectedKey={status}
        >
          <SelectItem id="all">All statuses</SelectItem>
          <SelectItem id="completed">Completed</SelectItem>
          <SelectItem id="pending">Pending</SelectItem>
          <SelectItem id="rejected">Rejected</SelectItem>
        </Select>
        <Input
          aria-label="Filter transactions by date"
          onChange={updateFilter(setDate)}
          type="date"
          value={date}
        />
      </div>

      {error ? (
        <FeedbackMessage tone="error">
          {error.message || "Unable to load your transactions."}
        </FeedbackMessage>
      ) : isPending ? (
        <ContentSkeleton cards={1} label="Loading transaction history" />
      ) : (
        <>
          <TransactionTable transactions={pageItems} />
          {filteredTransactions.length > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-body-2-medium text-[var(--color-text-secondary)]">
                Page {safePage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={safePage === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  size="small"
                  variant="secondary"
                >
                  Previous
                </Button>
                <Button
                  disabled={safePage === totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  size="small"
                  variant="secondary"
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

export default TransactionHistoryPage;
