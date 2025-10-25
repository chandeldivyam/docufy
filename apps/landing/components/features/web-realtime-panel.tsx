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

// CRM-style sample docs
const DOCS: Doc[] = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    summary: 'Create a site, invite teammates, and publish fast.',
    sections: [
      {
        heading: 'Create your site',
        body: ['Sign in, click New site, pick a theme.', 'Private by default. Share when ready.'],
      },
      {
        heading: 'Connect your product',
        body: ['Install the snippet for in-app links.', 'Turn on search with a scoped key.'],
      },
    ],
    agentLine: 'Tip: Add a Start here collection for new customers.',
  },
  {
    slug: 'managing-contacts',
    title: 'Managing contacts',
    summary: 'Import, deduplicate, and keep data clean.',
    sections: [
      {
        heading: 'Bulk import',
        body: ['Drag and drop CSV or connect Sheets.', 'Use mapping presets for columns.'],
      },
      {
        heading: 'Deduplication',
        body: ['Enable fuzzy match on name and email.', 'Review suggestions before merge.'],
      },
    ],
    agentLine: 'Automation: Tag imports with missing lifecycle stage.',
  },
  {
    slug: 'pipelines',
    title: 'Pipelines and stages',
    summary: 'Define stages, SLAs, and automations.',
    sections: [
      {
        heading: 'Customize your pipeline',
        body: ['Add stages and owners. Changes go live instantly.', 'Notify reps on stale deals.'],
      },
    ],
    agentLine: 'Insight: Deals stuck in Qualified over 21 days underperform.',
  },
  {
    slug: 'integrations',
    title: 'Integrations',
    summary: 'Connect Gmail, Slack, and your warehouse.',
    sections: [
      {
        heading: 'Email and calendar',
        body: ['Connect Google or Microsoft.', 'Scoped tokens keep data safe.'],
      },
    ],
    agentLine: 'Setup: Send Critical ticket alerts to #support-live.',
  },
];

export function WebRealtimePanel() {
  const [slug, setSlug] = React.useState(DOCS[0]?.slug ?? 'getting-started');

  // Respect reduced motion
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const set = () => setReduced(mq.matches);
    set();
    mq.addEventListener?.('change', set);
    return () => mq.removeEventListener?.('change', set);
  }, []);

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
        <div className="text-muted-foreground truncate text-xs">docs/crm/{slug}.mdx</div>

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
          <DocNav slug={slug} onSelect={(next) => setSlug(next)} className="" />
        </nav>

        {/* Read-only content area */}
        <section className="relative h-[var(--panel-h)] overflow-y-auto">
          <div className="p-4 sm:p-6">
            <div className="text-muted-foreground mb-4 text-sm">
              <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5">
                /docs/crm
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
