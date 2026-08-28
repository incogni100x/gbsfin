import { QueryClient } from "@tanstack/react-query";

export const QUERY_CACHE_KEY = "globalsfin-query-cache";
export const QUERY_CACHE_MAX_AGE = 30 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: QUERY_CACHE_MAX_AGE,
      staleTime: 30 * 1000,
    },
  },
});

export function clearPersistedQueryCache() {
  queryClient.clear();

  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(QUERY_CACHE_KEY);
  }
}
