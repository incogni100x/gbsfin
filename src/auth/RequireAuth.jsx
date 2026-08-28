import { isSupabaseConfigured } from "@/lib/supabase/client.js";
import FullScreenLoader from "@/components/ui/FullScreenLoader.jsx";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "./useAuth.js";

function RequireAuth({ children }) {
  const location = useLocation();
  const { loading, session, sessionVerified } = useAuth();

  if (!isSupabaseConfigured) {
    return (
      <main className="grid min-h-svh place-items-center px-4 text-center">
        <div>
          <h1 className="text-title-2-medium">Supabase setup required</h1>
          <p className="text-body-medium mt-2 text-[var(--color-text-secondary)]">
            Add the local Supabase URL and publishable key to .env.local.
          </p>
        </div>
      </main>
    );
  }

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!session || !sessionVerified) {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  return children;
}

export default RequireAuth;
