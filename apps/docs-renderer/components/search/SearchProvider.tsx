// apps/docs-renderer/components/search/SearchProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Define the shape of the search configuration
type SearchCfg = {
  key: string;
  collection: string;
  nodes: Array<{ host: string; port: number; protocol: string }>;
  expiresAt: string; // This is typically an ISO 8601 string
  defaults: Record<string, string | number>;
};

// Define the context shape
type SearchContextType = {
  cfg: SearchCfg | null;
  error: string | null;
};

// Create the context with a default value
const SearchContext = createContext<SearchContextType>({
  cfg: null,
  error: null,
});

// 5 minutes is a safe buffer.
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Create the provider component
export function SearchProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<SearchContextType>({
    cfg: null,
    error: null,
  });

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const fetchAndScheduleRefresh = async () => {
      try {
        const response = await fetch('/api/search-config', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to fetch search config: ${response.statusText}`);
        }

        const json: SearchCfg = await response.json();
        setValue({ cfg: json, error: null });

        // --- Proactive Refresh Logic ---
        const expirationTime = new Date(json.expiresAt).getTime();
        const now = Date.now();

        // Calculate the delay for the next refresh, including the safety buffer
        const refreshDelay = expirationTime - now - REFRESH_BUFFER_MS;

        // Only schedule a refresh if the key is valid for a reasonable amount of time
        if (refreshDelay > 0) {
          timeoutId = setTimeout(fetchAndScheduleRefresh, refreshDelay);
        } else {
          // If the key is already expired or about to, log an error.
          // The user might need to refresh if they were offline for a long time.
          console.error('Received an expired or nearly-expired search key.');
        }
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setValue({ cfg: null, error: errorMessage });
        console.error('Search config fetch failed:', errorMessage);
      }
    };

    // Perform the initial fetch
    fetchAndScheduleRefresh();

    // Cleanup function: clear the timeout when the component unmounts
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []); // Empty dependency array ensures this setup runs only once

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

// Create a custom hook for easy consumption of the context
export function useSearch() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}
