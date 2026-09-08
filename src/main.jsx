import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
//import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App.jsx";
import AuthProvider from "./auth/AuthProvider.jsx";
import {
  QUERY_CACHE_KEY,
  QUERY_CACHE_MAX_AGE,
  queryClient,
} from "./lib/queryClient.js";

const persistedQueryRoots = new Set([
  "user-accounts",
  "deposit-overview",
  "deposit-history",
  "transactions",
  "currency-transfers",
  "bank-transfers",
  "fixed-deposits",
  "fixed-deposit-rates",
  "loans",
  "loan-options",
]);

const queryClientPersister = createAsyncStoragePersister({
  key: QUERY_CACHE_KEY,
  storage: window.sessionStorage,
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        buster: "banking-cache-v1",
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" &&
            persistedQueryRoots.has(query.queryKey[0]),
        },
        maxAge: QUERY_CACHE_MAX_AGE,
        persister: queryClientPersister,
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
);
