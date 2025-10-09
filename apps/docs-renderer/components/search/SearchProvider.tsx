// apps/docs-renderer/components/search/SearchProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

// Define the shape of the search configuration, mirroring what was in SearchCommand.tsx
type SearchCfg = {
  key: string;
  collection: string;
  nodes: Array<{ host: string; port: number; protocol: string }>;
  expiresAt: string;
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

// Create the provider component
export function SearchProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<SearchContextType>({
    cfg: null,
    error: null,
  });

  useEffect(() => {
    // This effect runs only once on the client when the component mounts
    let alive = true;
    fetch('/api/search-config', { cache: 'force-cache' }) // Use browser cache
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((json) => {
        if (alive) setValue({ cfg: json, error: null });
      })
      .catch((e: Error) => {
        if (alive) setValue({ cfg: null, error: e.message });
      });

    return () => {
      alive = false;
    };
  }, []); // Empty dependency array ensures this runs only once

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
