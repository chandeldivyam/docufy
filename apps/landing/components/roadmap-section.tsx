'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Rocket,
  Layers,
  RotateCcw,
  GitBranch,
  Terminal,
  GitPullRequest,
  Globe,
  Search,
  Tags,
  Link2,
  LayoutTemplate,
  MessageSquare,
  BarChart3,
  Languages,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

type Bucket = 'now' | 'next' | 'later';
type Status = 'in-progress' | 'planned' | 'shipped';

type RoadmapItem = {
  id: string;
  title: string;
  summary: string;
  bucket: Bucket;
  status: Status;
  progress?: number; // 0..100 — shown when in-progress
  icon: React.ElementType;
};

const ITEMS: RoadmapItem[] = [
  // NOW
  {
    id: 'versions-rollback',
    title: 'Versions & rollback',
    summary:
      'Immutable builds with version history and one‑click rollback. Also enable single‑link page publish for targeted updates.',
    bucket: 'now',
    status: 'in-progress',
    progress: 45,
    icon: Layers,
  },
  {
    id: 'openapi-url-refetch',
    title: 'OpenAPI by URL + daily refetch',
    summary: 'Point to a spec URL; we refetch every 24h and redeploy automatically.',
    bucket: 'now',
    status: 'in-progress',
    progress: 55,
    icon: Link2,
  },
  {
    id: 'basepath-sites',
    title: 'Base‑path sites',
    summary: 'Serve docs from /docs (yourdomain.com/docs) in addition to CNAME subdomains.',
    bucket: 'now',
    status: 'planned',
    icon: Globe,
  },
  {
    id: 'helpful-feedback',
    title: '“Was this page helpful?”',
    summary: 'Thumbs up/down with per‑page analytics visible in the app (opt‑in).',
    bucket: 'now',
    status: 'planned',
    icon: MessageSquare,
  },

  // NEXT
  {
    id: 'cli-sync',
    title: 'CLI + terminal sync',
    summary: 'Pull/push, preview, diff, and publish from your repo or local files.',
    bucket: 'next',
    status: 'planned',
    icon: Terminal,
  },
  {
    id: 'github-agent',
    title: 'GitHub agent',
    summary: 'Connect a repo for PR previews and commit‑driven publishes.',
    bucket: 'next',
    status: 'planned',
    icon: GitPullRequest,
  },
  {
    id: 'roles-permissions',
    title: 'Roles & permissions',
    summary: 'Owner / Editor / Viewer roles; page‑level visibility controls.',
    bucket: 'next',
    status: 'planned',
    icon: ShieldCheck,
  },
  {
    id: 'search-ranking',
    title: 'Search tuning',
    summary: 'Ranking presets, synonyms (billing ↔ payments), and per‑space filters.',
    bucket: 'next',
    status: 'planned',
    icon: Search,
  },

  // LATER
  {
    id: 'i18n',
    title: 'Internationalization',
    summary: 'Serve the same content in multiple locales (en, es, fr…).',
    bucket: 'later',
    status: 'planned',
    icon: Languages,
  },
  {
    id: 'analytics',
    title: 'Site analytics (opt‑in)',
    summary: 'Traffic, time on page, and top searches for each docs site.',
    bucket: 'later',
    status: 'planned',
    icon: BarChart3,
  },
  {
    id: 'tag-grouping',
    title: 'Tag‑based grouping',
    summary:
      'Create groups automatically from tags; hide draft pages from publish; custom docs slugs.',
    bucket: 'later',
    status: 'planned',
    icon: Tags,
  },
  {
    id: 'layouts',
    title: 'Renderer layouts',
    summary: 'Switch between Help Center and API Docs layouts with tailored chrome.',
    bucket: 'later',
    status: 'planned',
    icon: LayoutTemplate,
  },
];

export function RoadmapSection() {
  const [bucket, setBucket] = React.useState<Bucket | 'all'>('now');
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const filtered = bucket === 'all' ? ITEMS : ITEMS.filter((i) => i.bucket === bucket);

  return (
    <section
      id="roadmap"
      className="relative mx-auto w-full max-w-6xl scroll-mt-24 px-4 py-3 sm:py-5"
      aria-labelledby="roadmap-title"
    >
      <div className="bg-muted/40 grid gap-6 rounded-2xl p-6 md:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="roadmap-title" className="text-balance text-2xl tracking-tight sm:text-3xl">
              Open roadmap
            </h2>
            <p className="text-muted-foreground mt-1">
              What we’re building next—shipped continuously.
            </p>
          </div>

          {/* filter pills */}
          <div className="border-border/80 bg-card/70 flex items-center gap-1 rounded-lg border p-1">
            {[
              { id: 'now', label: 'Now', icon: Rocket },
              { id: 'next', label: 'Next', icon: GitBranch },
              { id: 'later', label: 'Later', icon: RotateCcw },
              { id: 'all', label: 'All', icon: Sparkles },
            ].map((opt) => {
              const active = bucket === (opt.id as Bucket | 'all');
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBucket(opt.id as Bucket | 'all')}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted/60',
                  ].join(' ')}
                >
                  <Icon className="size-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* content */}
        <ul className="grid gap-4 sm:grid-cols-2">
          {filtered.map((item) => (
            <li key={item.id}>
              <RoadmapCard item={item} reduced={reduced} />
            </li>
          ))}
        </ul>

        {/* contribute callout */}
        <div className="border-primary/20 bg-primary/5 flex flex-col items-start justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
          <p className="text-sm">
            We’re MIT‑licensed and open to contributions. Have feedback or a feature request?
          </p>
          <div className="flex items-center gap-2">
            <Link
              href="https://github.com/chandeldivyam/docufy/issues/new/choose"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Open an issue
            </Link>
            <span className="text-border">•</span>
            <Link
              href="https://github.com/chandeldivyam/docufy"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoadmapCard({ item, reduced }: { item: RoadmapItem; reduced: boolean }) {
  const Icon = item.icon;
  const status = statusBadge(item.status);
  const showProgress = item.status === 'in-progress' && typeof item.progress === 'number';
  const pct = Math.min(100, Math.max(0, item.progress ?? 0));

  return (
    <div
      className={[
        'border-muted/60 bg-card/70 ring-muted/60 rounded-xl border p-4 shadow-sm ring-1 transition-colors',
      ].join(' ')}
    >
      <div className="mb-1.5 flex items-start gap-2">
        <div className="bg-secondary text-secondary-foreground rounded-md p-1.5">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold">{item.title}</h3>
            <span
              className={[
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                status.className,
              ].join(' ')}
            >
              {status.label}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">{item.summary}</p>
        </div>
      </div>

      {/* progress */}
      {showProgress && (
        <div className="mt-3 space-y-1">
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div
              className="bg-primary h-full"
              style={{
                width: `${pct}%`,
                transition: reduced ? undefined : 'width 700ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
              aria-label={`Progress ${pct}%`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
            />
          </div>
          <p className="text-muted-foreground text-xs">{pct}% complete</p>
        </div>
      )}
    </div>
  );
}

function statusBadge(status: Status) {
  switch (status) {
    case 'in-progress':
      return { label: 'In progress', className: 'bg-primary/10 text-primary' };
    case 'shipped':
      return {
        label: 'Shipped',
        className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      };
    default:
      return { label: 'Planned', className: 'bg-muted text-muted-foreground' };
  }
}
