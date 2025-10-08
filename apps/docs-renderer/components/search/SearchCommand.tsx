'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import type { Hit as AlgoliaHit } from 'instantsearch.js';
import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';
import { InstantSearch, Configure, Highlight, Snippet, useHits } from 'react-instantsearch';
import { useRouter } from 'next/navigation'; 

// ---------- Types ----------
type SearchCfg = {
  key: string;
  collection: string;
  nodes: Array<{ host: string; port: number; protocol: string }>;
  expiresAt: string;
  defaults: Record<string, string | number>;
};

type HitAttrs = {
  id: string;
  route: string;
  title: string;
  kind: 'page' | 'api';
  api_method?: string;
  api_path?: string;
  space_slug: string;
  plain?: string;
};
type DocHit = AlgoliaHit<HitAttrs>;

const RECENTS_KEY = 'dfy:search:recent';

// ---------- Hooks ----------
function useSearchConfig() {
  const [cfg, setCfg] = useState<SearchCfg | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/search-config', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j) => alive && setCfg(j))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);
  return { cfg, error };
}

function kbd(meta: boolean) {
  return meta ? '⌘' : 'Ctrl';
}

function useDebounced<T>(value: T, delay = 80) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
}

// ---------- Main ----------
export default function SearchCommand() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const { cfg } = useSearchConfig();

  // Build Typesense search client once
  const searchClient = useMemo(() => {
    if (!cfg) return null;
    const adapter = new TypesenseInstantSearchAdapter({
      server: { nodes: cfg.nodes, apiKey: cfg.key },
      additionalSearchParameters: {
        query_by: String(cfg.defaults.queryBy || 'title,plain'),
        query_by_weights: String(cfg.defaults.queryByWeights || '3,1'),
        num_typos: String(cfg.defaults.numTypos ?? 2),
        highlight_full_fields: String(cfg.defaults.highlightFullFields || 'title,plain'),
        infix: String(cfg.defaults.infix || 'off'),
      },
    });
    return adapter.searchClient;
  }, [cfg]);

  // Global hotkeys: Cmd/Ctrl+K and "/"
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || target?.isContentEditable;

      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!inField && e.key === '/') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!cfg || !searchClient) return null;

  return (
    <>
      {open
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Search docs"
              className="dfy-search-overlay"
              onClick={() => setOpen(false)}
            >
              <div className="dfy-search-panel" onClick={(e) => e.stopPropagation()}>
                <div className="dfy-search-header">
                  <input
                    ref={inputRef}
                    className="dfy-search-input"
                    placeholder="Search docs…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search input"
                    autoComplete="off"
                    spellCheck={false}
                    // ARIA combobox wiring
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="dfy-search-listbox"
                  />
                  <div className="dfy-search-kbd">{kbd(navigator.platform.includes('Mac'))}K</div>
                </div>

                <InstantSearch searchClient={searchClient} indexName={cfg.collection}>
                  <Configure query={debouncedQuery} hitsPerPage={10} />
                  <SearchResults
                    query={query}
                    onAccept={() => {
                      addRecent(query);
                      setOpen(false);
                    }}
                    inputRef={inputRef}
                  />
                </InstantSearch>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

// ---------- Recent searches ----------
function addRecent(q: string) {
  if (!q.trim()) return;
  try {
    const list: string[] = JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
    const next = [q, ...list.filter((x) => x !== q)].slice(0, 8);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

// ---------- Results (keyboard nav, a11y, selection) ----------
function SearchResults({
  query,
  onAccept,
  inputRef,
}: {
  query: string;
  onAccept: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { hits } = useHits<DocHit>();
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter(); 

  // Track keyboard mode
  const keyboardModeRef = useRef(false);
  const mouseMoveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedRef = useRef(selected);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Reset to mouse mode on intentional mouse movement
  useEffect(() => {
    const handleMouseMove = () => {
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
      mouseMoveTimeoutRef.current = setTimeout(() => {
        keyboardModeRef.current = false;
      }, 100); // Small delay to filter out accidental micro-movements
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (query.trim().length === 0 || hits.length === 0) {
      setSelected(0);
      return;
    }
    setSelected(0);
  }, [hits, query]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (query.trim().length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        keyboardModeRef.current = true; // Enter keyboard mode
        setSelected((i) => {
          const nextIndex = Math.min(i + 1, hits.length - 1);
          setTimeout(() => scrollToIndex(listRef.current, nextIndex), 0);
          return nextIndex;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        keyboardModeRef.current = true; // Enter keyboard mode
        setSelected((i) => {
          const nextIndex = Math.max(i - 1, 0);
          setTimeout(() => scrollToIndex(listRef.current, nextIndex), 0);
          return nextIndex;
        });
      } else if (e.key === 'Enter' && hits.length > 0) {
        e.preventDefault();
        const hit = hits[selectedRef.current];
        if (!hit) return;
        onAccept();
        const url = hit.route;
        if (e.metaKey || e.ctrlKey) {
          window.open(url, '_blank', 'noopener');
        } else if (e.shiftKey) {
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          router.push(url);
        }
      }
    };

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [hits, query, onAccept, inputRef, router]);

  const activeId =
    hits.length > 0 ? `dfy-hit-${String(hits[selected]?.objectID ?? selected)}` : undefined;

  if (query.trim().length === 0) {
    return <div className="dfy-search-empty"></div>;
  }

  return (
    <div
      ref={listRef}
      id="dfy-search-listbox"
      role="listbox"
      aria-label="Search results"
      aria-activedescendant={activeId}
    >
      {hits.length === 0 ? (
        <div className="dfy-search-empty">
          <p className="dfy-search-hint">No results. Try different keywords.</p>
        </div>
      ) : (
        <div>
          {hits.map((hit, i) => {
            const isSelected = i === selected;
            const isApi = hit.kind === 'api';
            const method = (hit.api_method || '').toUpperCase();

            return (
              <Link
                href={hit.route}
                key={hit.objectID}
                id={`dfy-hit-${String(hit.objectID)}`}
                role="option"
                aria-selected={isSelected}
                className={`dfy-hit ${isSelected ? 'dfy-hit-selected' : ''}`}
                onClick={() => {
                  addRecent(query);
                  onAccept();
                }}
                onMouseEnter={() => {
                  // Only respond to mouse if not in keyboard mode
                  if (!keyboardModeRef.current) {
                    setSelected(i);
                  }
                }}
              >
                <div className="dfy-hit-main">
                  {isApi ? <span className={`dfy-http ${method}`}>{method}</span> : null}
                  <div className="dfy-hit-title">
                    <Highlight attribute="title" hit={hit} />
                  </div>
                </div>
                <div className="dfy-hit-sub">
                  {hit.space_slug ? <span className="dfy-hit-space">{hit.space_slug}</span> : null}
                  {isApi && hit.api_path ? (
                    <span className="dfy-hit-path">{hit.api_path}</span>
                  ) : (
                    <span className="dfy-hit-path">{hit.route}</span>
                  )}
                </div>
                <div className="dfy-hit-snippet">
                  <Snippet attribute="plain" hit={hit} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function scrollToIndex(container: HTMLDivElement | null, index: number) {
  if (!container) return;
  const items = container.querySelectorAll<HTMLElement>('.dfy-hit');
  const el = items[index];
  if (el) el.scrollIntoView({ block: 'nearest' });
}
