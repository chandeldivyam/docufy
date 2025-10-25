'use client';

import * as React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Menu, X } from 'lucide-react';

type Doc = {
  slug: string;
  title: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
  agentLine: string;
};

// Docufy-focused sample docs (marketing-friendly copy)
const DOCS: Doc[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    summary: 'Create your site, invite your team, publish in one click.',
    sections: [
      {
        heading: 'Create your site',
        body: [
          'Sign in and click New site.',
          'Pick a theme; private by default. Share when ready.',
        ],
      },
      {
        heading: 'Write your first page',
        body: [
          'Use / to add headings, callouts, code, and media.',
          'Collaborate in real time — it feels local, even offline.',
        ],
      },
      {
        heading: 'Publish instantly',
        body: [
          'Press Publish to ship an atomic build.',
          'Connect docs.yourco.com when you’re ready.',
        ],
      },
    ],
    agentLine: 'Tip: Add a “Quickstart” and link it from your homepage.',
  },
  {
    slug: 'editor',
    title: 'Collaborative editor',
    summary: 'Fast, familiar, and designed for teams.',
    sections: [
      {
        heading: 'Real‑time, local‑first',
        body: [
          'See cursors, selections, and changes as they happen.',
          'No spinners — edits apply instantly and sync in the background.',
        ],
      },
      {
        heading: 'AI‑assisted writing',
        body: [
          'Select text and ask to rewrite, shorten, or outline.',
          'Keep your voice; accept, tweak, or undo in one click.',
        ],
      },
      {
        heading: 'Rich content',
        body: [
          'Code blocks with syntax highlight. Drag‑drop images.',
          'Embed callouts, tabs, and MDX‑powered components.',
        ],
      },
    ],
    agentLine: 'Try: Ask AI to tighten this intro into two crisp sentences.',
  },
  {
    slug: 'publishing',
    title: 'Publishing & domains',
    summary: 'Atomic, fast, and zero‑downtime by design.',
    sections: [
      {
        heading: 'One‑click publish',
        body: [
          'Each publish creates an immutable build.',
          'We swap an alias instantly — readers never see half‑built pages.',
        ],
      },
      {
        heading: 'Custom domains',
        body: ['Use docs.yourco.com or a subpath.', 'Verification is guided and quick.'],
      },
      {
        heading: 'Themes & brand',
        body: [
          'Start with a theme and tune colors, logo, and typography.',
          'Everything renders fast on the edge.',
        ],
      },
    ],
    agentLine: 'Insight: Publish swaps are atomic — every link stays stable.',
  },
  {
    slug: 'search',
    title: 'Search & structure',
    summary: 'Give answers, not results.',
    sections: [
      {
        heading: 'Instant search',
        body: [
          'Blazing‑fast results with typo tolerance.',
          'Short‑lived, scoped keys keep it safe.',
        ],
      },
      {
        heading: 'Information architecture',
        body: [
          'Organize with spaces, collections, and tags.',
          'Hide draft pages from publish; choose friendly slugs.',
        ],
      },
      {
        heading: 'Tune relevance',
        body: [
          'Add synonyms (billing, payments, invoices).',
          'Pin important pages and boost fresh releases.',
        ],
      },
    ],
    agentLine: 'Setup: Add synonyms for “billing” → “payments”, “invoice”.',
  },
  {
    slug: 'api-docs',
    title: 'API docs',
    summary: 'Turn OpenAPI into beautiful, usable docs.',
    sections: [
      {
        heading: 'Ingest your spec',
        body: [
          'Point to an OpenAPI URL or upload a file.',
          'Docufy renders endpoints, parameters, and examples automatically.',
        ],
      },
      {
        heading: 'Stay in sync',
        body: ['Re‑publish when your spec changes.', 'Versioning and rollback keep history tidy.'],
      },
      {
        heading: 'DX details',
        body: ['Copyable code blocks in multiple languages.', 'Deep links that never break.'],
      },
    ],
    agentLine: 'Tip: Link “API Quickstart” beside your SDK install guide.',
  },
];

export function WebRealtimePanel() {
  const [slug, setSlug] = React.useState(DOCS[0]?.slug ?? 'getting-started');
  const [userSelected, setUserSelected] = React.useState(false);

  // Respect reduced motion
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const set = () => setReduced(mq.matches);
    set();
    mq.addEventListener?.('change', set);
    return () => mq.removeEventListener?.('change', set);
  }, []);

  // Pick up initial doc from the URL (?doc=slug) for shareability
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const param = url.searchParams.get('doc');
    if (param && DOCS.some((d) => d.slug === param)) {
      setSlug(param);
      setUserSelected(true); // respect deep-linked choice; disable rotation
    }
  }, []);

  // Auto-rotate between docs until the user interacts (or reduced motion)
  React.useEffect(() => {
    if (userSelected || reduced) return;
    const id = setInterval(() => {
      setSlug((prev) => {
        const i = Math.max(
          0,
          DOCS.findIndex((d) => d.slug === prev),
        );
        const next = DOCS[(i + 1) % DOCS.length]?.slug ?? 'getting-started';
        return next;
      });
    }, 4800);
    return () => clearInterval(id);
  }, [userSelected, reduced]);

  // Simulate an AI line streaming into the doc
  const doc = (DOCS.find((d) => d.slug === slug) ?? DOCS[0])!;
  const [agentTyped, setAgentTyped] = React.useState('');
  React.useEffect(() => {
    if (reduced) {
      setAgentTyped(doc.agentLine);
      return;
    }
    setAgentTyped('');
    let i = 0;
    const id = setInterval(
      () => {
        i++;
        setAgentTyped(doc.agentLine.slice(0, i));
        if (i >= doc.agentLine.length) clearInterval(id);
      },
      18 + Math.random() * 30,
    );
    return () => clearInterval(id);
  }, [doc, reduced]);

  // Mobile drawer state
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // Close on Escape
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Prevent body scroll when drawer is open
  React.useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [drawerOpen]);

  return (
    <div
      className="border-muted/60 bg-card/70 ring-muted/60 h-[var(--panel-h)] w-full overflow-hidden rounded-2xl border shadow-xl ring-1 backdrop-blur"
      role="group"
      aria-label="Read-only editor preview with instant updates"
    >
      {/* window chrome */}
      <div className="border-border/70 flex items-center gap-2 border-b px-3 py-2">
        {/* Mobile hamburger */}
        <button
          type="button"
          className="hover:bg-muted/60 focus-visible:ring-primary mr-1 inline-flex size-8 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 md:hidden"
          aria-label="Open docs navigation"
          aria-controls="doc-drawer"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <Menu className="size-4" aria-hidden="true" />
        </button>

        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="bg-border/70 mx-3 hidden h-4 w-px sm:block" />
        <div className="text-muted-foreground truncate text-xs">docs/{slug}.mdx</div>

        <div className="ml-auto hidden items-center gap-2 sm:flex">
          <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px]">
            Live
          </span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
            Local first
          </span>
        </div>
      </div>

      {/* layout - single column on mobile, sidebar appears via drawer */}
      <div className="grid h-full w-full gap-0 md:grid-cols-[220px_1fr]">
        {/* Desktop nav */}
        <nav className="border-border/70 hidden border-r p-3 text-sm md:block">
          <DocNav
            slug={slug}
            onSelect={(next) => {
              setSlug(next);
              setUserSelected(true);
              // Update URL param to reflect user choice
              try {
                const url = new URL(window.location.href);
                url.searchParams.set('doc', next);
                window.history.replaceState({}, '', url);
              } catch {
                console.error('Failed to update URL param');
              }
            }}
            className=""
          />
        </nav>

        {/* Read-only content area */}
        <section className="relative h-[var(--panel-h)] overflow-y-auto">
          <div className="p-4 sm:p-6">
            <div className="text-muted-foreground mb-4 text-sm">
              <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5">
                /docs
              </span>
              <span className="text-border mx-2">•</span>
              {doc.slug}.mdx
            </div>

            <article aria-live="polite" className="text-foreground font-sans leading-7">
              <h2 className="mb-2 text-xl font-semibold tracking-tight">{doc.title}</h2>
              <p className="text-muted-foreground mb-3">{doc.summary}</p>
              {doc.sections.map((s) => (
                <div key={s.heading} className="mb-4">
                  <h3 className="mb-1 mt-3 text-lg font-semibold">{s.heading}</h3>
                  {s.body.map((p, i) => (
                    <p key={i} className="text-muted-foreground">
                      {p}
                    </p>
                  ))}
                </div>
              ))}
              {agentTyped && (
                <div className="border-primary/20 bg-primary/5 mt-4 rounded-lg border p-3">
                  <p className="text-primary text-sm">
                    <span className="font-semibold">AI: </span>
                    {agentTyped}
                    {agentTyped.length < doc.agentLine.length && (
                      <span className="bg-primary ml-0.5 inline-block h-4 w-0.5 animate-pulse" />
                    )}
                  </p>
                </div>
              )}
            </article>
          </div>
        </section>
      </div>

      {/* Mobile drawer for nav */}
      {drawerOpen && (
        <div
          id="doc-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doc-drawer-title"
          className="fixed inset-0 z-50 md:hidden"
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="border-border/70 bg-card absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col rounded-r-2xl border-r p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 id="doc-drawer-title" className="text-sm font-semibold">
                Docs
              </h3>
              <button
                type="button"
                className="hover:bg-muted/60 focus-visible:ring-primary inline-flex size-8 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <DocNav
              slug={slug}
              onSelect={(next) => {
                setSlug(next);
                setUserSelected(true);
                try {
                  const url = new URL(window.location.href);
                  url.searchParams.set('doc', next);
                  window.history.replaceState({}, '', url);
                } catch {
                  console.error('Failed to update URL param');
                }
                setDrawerOpen(false);
              }}
              className="flex-1 overflow-y-auto"
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function DocNav({
  slug,
  onSelect,
  className,
}: {
  slug: string;
  onSelect: (slug: string) => void;
  className?: string;
}) {
  return (
    <ul className={clsx('space-y-1.5', className)}>
      {DOCS.map((d) => {
        const active = d.slug === slug;
        return (
          <li key={d.slug}>
            <Link
              prefetch={false}
              href={`?doc=${d.slug}`}
              onClick={(e) => {
                e.preventDefault();
                onSelect(d.slug);
              }}
              className={clsx(
                'block rounded-md px-2 py-1.5',
                active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/40',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {d.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
