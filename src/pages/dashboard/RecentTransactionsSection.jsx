import { Link } from "react-router";
import TransactionTable from "../transaction-history/TransactionTable.jsx";

function RecentTransactionsSection({ isPending, transactions }) {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-title-3-medium sm:text-title-2-medium">
          Recent transactions
        </h2>
        <Link
          className="text-body-medium text-[var(--color-accent-600)] underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current"
          to="/transaction-history"
        >
          View all
        </Link>
      </div>
      {isPending ? (
        <div className="h-40 animate-pulse rounded-[var(--radius-2lg)] border border-[var(--color-separator-border)] bg-[var(--color-background-primary-default)] motion-reduce:animate-none" />
      ) : (
        <TransactionTable transactions={transactions} />
      )}
    </section>
  );
}

export default RecentTransactionsSection;
