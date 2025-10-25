'use client';

import * as React from 'react';

/**
 * CollaborativeEditorDemo
 * - Purely presentational “animation” (no interactivity)
 * - Respects prefers-reduced-motion (keeps a static first frame)
 * - Pointer events disabled to prevent user interactions
 * - Works on mobile (single-pane) and larger screens (pane + preview)
 */
export function CollaborativeEditorDemo() {
  const [mounted, setMounted] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [typed, setTyped] = React.useState('');
  const [cursorStep, setCursorStep] = React.useState(0);

  // The line we "type" into the editor.
  const fullLine = 'Build a blazing‑fast help center your customers will love.';

  // “Cursor” keyframes (top/left in percentages relative to editor body)
  const frames = React.useMemo(
    () => [
      { a: { top: 10, left: 16 }, b: { top: 54, left: 12 } },
      { a: { top: 18, left: 26 }, b: { top: 48, left: 30 } },
      { a: { top: 34, left: 24 }, b: { top: 42, left: 62 } },
      { a: { top: 40, left: 6 }, b: { top: 30, left: 38 } },
      { a: { top: 28, left: 10 }, b: { top: 16, left: 42 } },
    ],
    [],
  );

  React.useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mq.matches);
      const onChange = () => setReducedMotion(mq.matches);
      mq.addEventListener?.('change', onChange);
      return () => mq.removeEventListener?.('change', onChange);
    }
  }, []);

  // Typing effect
  React.useEffect(() => {
    if (!mounted || reducedMotion) return;
    if (typed.length >= fullLine.length) return;

    const t = setTimeout(
      () => {
        setTyped(fullLine.slice(0, typed.length + 1));
      },
      30 + Math.random() * 70,
    ); // a little human-like jitter
    return () => clearTimeout(t);
  }, [mounted, reducedMotion, typed, fullLine]);

  // Cursor movement loop
  React.useEffect(() => {
    if (!mounted || reducedMotion) return;
    const t = setInterval(() => {
      setCursorStep((s) => (s + 1) % frames.length);
    }, 1200);
    return () => clearInterval(t);
  }, [mounted, reducedMotion, frames.length]);

  // Freeze animation when user prefers reduced motion
  const current = frames[cursorStep];

  return (
    <div
      className="border-primary/70 bg-card/70 ring-primary/70 pointer-events-none w-full rounded-2xl border shadow-xl ring-1 backdrop-blur"
      aria-label="Docufy collaborative editor preview"
      role="group"
    >
      {/* Window bar */}
      <div className="border-border/70 flex items-center gap-2 border-b px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
        </div>
        <div className="bg-border/70 mx-3 h-4 w-px" />
        <div className="text-muted-foreground truncate text-xs">docs/getting-started.mdx</div>

        <div className="ml-auto flex items-center -space-x-2">
          <Avatar name="Monica Gellar" colorClass="bg-primary" />
          <Avatar name="Alex Rivera" colorClass="bg-primary" />
          <span className="bg-muted text-muted-foreground ml-3 rounded-full px-2 py-0.5 text-[10px]">
            Live
          </span>
        </div>
      </div>

      {/* Content: left sidebar + editor (mobile hides sidebar), right preview (hidden on small) */}
      <div className="grid w-full gap-0 md:grid-cols-[220px_1fr] lg:grid-cols-[220px_1fr_360px]">
        {/* Sidebar */}
        <aside className="border-border/70 hidden border-r md:block">
          <SidebarNav />
        </aside>

        {/* Editor body */}
        <section className="relative">
          <div className="relative">
            {/* Grid background */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-b-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(1200px_400px_at_50%_-20%,oklch(0.9245_0.0138_92.9892)/60,transparent_60%)]" />
            </div>

            {/* Lines */}
            {current && (
              <div className="relative z-10 p-4 sm:p-6">
                <EditorLines
                  typed={reducedMotion ? fullLine : typed}
                  showCarets={!reducedMotion}
                  carets={current}
                />
              </div>
            )}
          </div>
        </section>

        {/* Live preview (marketing gloss) */}
        <section className="border-border/70 relative hidden border-l lg:block">
          <LivePreview />
        </section>
      </div>

      {/* component-scoped keyframes */}
      <style jsx>{`
        .blink {
          animation: blink 1s steps(1, end) infinite;
        }
        @keyframes blink {
          0%,
          45% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

function Avatar({ name, colorClass }: { name: string; colorClass: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
  return (
    <div
      className={`ring-card flex size-6 items-center justify-center rounded-full ring-2 ${colorClass}`}
      title={name}
      aria-label={name}
    >
      <span className="text-primary-foreground text-[10px] font-semibold">{initials}</span>
    </div>
  );
}

function SidebarNav() {
  const items = [
    'Introduction',
    'Getting started',
    'Installation',
    'Write your first article',
    'Customize theme',
    'Publish & share',
  ];
  return (
    <ul className="space-y-1.5 p-3 text-sm">
      {items.map((label, i) => (
        <li
          key={label}
          className={`rounded-md px-2 py-1.5 ${
            i === 1 ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/40'
          }`}
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

function EditorLines({
  typed,
  showCarets,
  carets,
}: {
  typed: string;
  showCarets: boolean;
  carets: { a: { top: number; left: number }; b: { top: number; left: number } };
}) {
  return (
    <div className="relative overflow-hidden rounded-b-2xl">
      <div className="border-border/70 bg-background relative rounded-lg border p-4 shadow-sm">
        <div className="text-muted-foreground mb-4 text-sm">
          <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5">
            /docs
          </span>
          <span className="text-border mx-2">•</span>
          getting-started.mdx
        </div>

        {/* The “document” */}
        <div className="text-foreground relative font-sans leading-7">
          <h2 className="mb-2 text-xl font-semibold tracking-tight">Getting started</h2>
          <p className="text-muted-foreground mb-3">
            Welcome to Docufy. Collaborate on beautiful docs, ship help centers and keep everything
            in sync with your product.
          </p>
          <h3 className="mb-1 mt-4 text-lg font-semibold">Why Docufy?</h3>
          <ul className="text-muted-foreground mb-4 list-disc pl-5">
            <li>Real‑time collaboration</li>
            <li>AI‑assisted authoring</li>
            <li>Blazing‑fast publishing</li>
          </ul>

          <div className="border-border/70 bg-muted/40 relative rounded-md border border-dashed p-3">
            <div className="text-muted-foreground text-xs uppercase tracking-wide">
              Hero tagline
            </div>
            <div className="mt-1 font-medium">
              {typed}
              {/* caret for the typing line */}
              {showCarets && (
                <span className="blink bg-primary inline-block h-5 w-0.5 align-[-2px]" />
              )}
            </div>
          </div>
        </div>

        {/* collaborator selections */}
        {showCarets && (
          <>
            <Selection
              label="Monica"
              pos={carets.a}
              colorClassName="bg-primary"
              borderColorClassName="border-accent-foreground"
              textColorClassName="text-primary-foreground"
            />
            <Selection
              label="Alex"
              pos={carets.b}
              colorClassName="bg-accent"
              borderColorClassName="border-accent-foreground"
              textColorClassName="text-accent-foreground"
            />
          </>
        )}
      </div>

      {/* collapse gradient at bottom for visual polish */}
      <div
        aria-hidden="true"
        className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t to-transparent"
      />
    </div>
  );
}

function Selection({
  pos,
  label,
  colorClassName,
  borderColorClassName,
  textColorClassName,
}: {
  pos: { top: number; left: number };
  label: string;
  colorClassName: string;
  borderColorClassName: string;
  textColorClassName: string;
}) {
  return (
    <div
      className="absolute transition-all duration-700 ease-out"
      style={{
        top: `${pos.top}%`,
        left: `${pos.left}%`,
      }}
    >
      <div
        className={`-ml-px flex items-center rounded-r-md border-l-2 ${colorClassName} ${borderColorClassName}`}
      >
        <div className={`py-0.5 pl-1.5 pr-2 text-xs font-medium ${textColorClassName}`}>
          {label}
        </div>
      </div>
    </div>
  );
}

function LivePreview() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-border/70 flex items-center justify-between border-b px-4 py-2 text-xs">
        <span className="text-muted-foreground">Preview</span>
        <span className="bg-muted text-muted-foreground rounded px-2 py-0.5">/help-center</span>
      </div>
      <div className="relative flex flex-1 items-center justify-center p-6">
        <div className="border-border/70 bg-background w-full max-w-[280px] rounded-xl border p-4 shadow-sm">
          <div className="bg-primary/10 h-6 rounded" />
          <div className="mt-3 space-y-2">
            <div className="bg-muted h-2.5 rounded" />
            <div className="bg-muted/80 h-2.5 rounded" />
            <div className="bg-muted/60 h-2.5 w-2/3 rounded" />
          </div>
          <div className="bg-primary/15 mt-4 h-8 rounded-md" />
        </div>
      </div>
    </div>
  );
}
