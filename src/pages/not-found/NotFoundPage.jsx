import { Button } from "@/components/base/buttons/button";
import { Link, useNavigate } from "react-router";

function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <main className="grid min-h-svh place-items-center bg-[var(--color-background-full)] px-4 py-10 text-center">
      <section className="w-full max-w-lg">
        <Link
          className="text-title-2-semibold inline-flex items-center gap-2 text-[var(--color-text-primary)] no-underline"
          to="/dashboard"
        >
          <img alt="" className="size-9" src="/logo.svg" />
          Global Stripe Fin
        </Link>

        <p className="mt-10 text-[5rem] leading-none font-semibold tracking-[-0.04em] text-[var(--color-accent-600)] sm:text-[7rem]">
          404
        </p>
        <h1 className="text-title-1-medium mt-5 text-[var(--color-text-primary)]">
          Page not found
        </h1>
        <p className="text-body-medium mx-auto mt-2 max-w-md text-[var(--color-text-secondary)]">
          The page you’re looking for may have moved, been removed, or never
          existed.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={() => navigate("/dashboard")}>
            Return to dashboard
          </Button>
          <Button onClick={() => navigate("/login")} variant="secondary">
            Sign in
          </Button>
        </div>
      </section>
    </main>
  );
}

export default NotFoundPage;
