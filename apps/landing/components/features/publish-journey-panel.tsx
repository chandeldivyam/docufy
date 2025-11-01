'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  Globe,
  Loader2,
  MousePointerClick,
  Palette,
  Rocket,
  Sparkles,
} from 'lucide-react';

type ThemeSwatch = {
  id: string;
  name: string;
  primary: string;
  bg: string;
  accent: string;
};

const THEMES: ThemeSwatch[] = [
  { id: 'indigo', name: 'Indigo', primary: '#6366f1', bg: '#eef2ff', accent: '#c7d2fe' },
  { id: 'rose', name: 'Rose', primary: '#f43f5e', bg: '#ffe4e6', accent: '#fecdd3' },
  { id: 'emerald', name: 'Emerald', primary: '#10b981', bg: '#d1fae5', accent: '#a7f3d0' },
];

type StepState = 'upcoming' | 'active' | 'completed';

export function PublishJourneyPanel() {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Journey state
  const [themeIdx, setThemeIdx] = useState(0);
  const [typedDomain, setTypedDomain] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [published, setPublished] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  // Step tracking
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Mobile: show preview after publish
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  // Cursor
  const [cursor, setCursor] = useState({ top: 20, left: 20 });
  const [clicking, setClicking] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  const toPct = useCallback((el: HTMLElement | null) => {
    const host = leftRef.current;
    if (!host || !el) return { top: 20, left: 20 };
    const a = host.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    return {
      top: Math.min(100, Math.max(0, ((cy - a.top) / a.height) * 100)),
      left: Math.min(100, Math.max(0, ((cx - a.left) / a.width) * 100)),
    };
  }, []);

  // Auto-scroll helper - FIXED VERSION
  const scrollToStep = useCallback(
    (stepRef: React.RefObject<HTMLDivElement | null>) => {
      const container = leftRef.current;
      const step = stepRef.current;

      if (!container || !step) {
        console.log('Scroll skipped: missing refs', { container: !!container, step: !!step });
        return;
      }

      // Get current scroll position and element position
      const containerTop = container.scrollTop;
      const stepOffsetTop = step.offsetTop;
      const containerHeight = container.clientHeight;
      const stepHeight = step.offsetHeight;

      // Calculate target scroll to center the step (with slight bias to top)
      const targetScroll = stepOffsetTop - containerHeight / 2 + stepHeight / 2 - 40;

      console.log('Scrolling to step:', {
        stepOffsetTop,
        containerHeight,
        targetScroll,
        currentScroll: containerTop,
      });

      // Perform scroll
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: reduced ? 'auto' : 'smooth',
      });
    },
    [reduced],
  );

  // Animated journey
  useEffect(() => {
    if (!mounted) return;

    if (reduced) {
      setThemeIdx(1);
      setTypedDomain('docs.yourco.com');
      setVerified(true);
      setPublished(true);
      setProgress(100);
      setActiveStep(3);
      setCompletedSteps(new Set([1, 2, 3]));
      setShowMobilePreview(true);
      return;
    }

    let cancelled = false;
    const timers: number[] = [];
    let raf = 0;
    const sleep = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)));

    const click = async (el: HTMLElement | null, pause = 200) => {
      setCursor(toPct(el));
      await sleep(300);
      setClicking(true);
      await sleep(pause);
      setClicking(false);
      await sleep(150);
    };

    const run = async () => {
      while (!cancelled) {
        console.log('=== Starting new cycle ===');

        // Reset
        setActiveStep(1);
        setCompletedSteps(new Set());
        setThemeIdx(0);
        setTypedDomain('');
        setVerifying(false);
        setVerified(false);
        setPublishing(false);
        setProgress(0);
        setPublished(false);
        setCelebrating(false);
        setShowMobilePreview(false);

        // Scroll to top
        if (leftRef.current) {
          leftRef.current.scrollTo({ top: 0, behavior: 'auto' });
          console.log('Scrolled to top');
        }

        await sleep(600);

        // STEP 1: Choose theme
        console.log('=== Step 1: Theme ===');
        await sleep(200);
        scrollToStep(step1Ref);
        await sleep(400);
        setCursor(toPct(step1Ref.current));
        await sleep(700);

        // Click through themes
        for (let i = 0; i < 3; i++) {
          if (cancelled) return;
          await click(step1Ref.current, 220);
          setThemeIdx((prev) => (prev + 1) % THEMES.length);
          await sleep(650);
        }

        setCompletedSteps(new Set([1]));
        await sleep(400);
        setActiveStep(2);
        await sleep(500);

        // STEP 2: Domain
        console.log('=== Step 2: Domain ===');
        scrollToStep(step2Ref);
        await sleep(600);
        setCursor(toPct(step2Ref.current));
        await sleep(500);

        // Type domain
        const domain = 'docs.yourco.com';
        for (let i = 1; i <= domain.length; i++) {
          if (cancelled) return;
          setTypedDomain(domain.slice(0, i));
          await sleep(25 + Math.random() * 35);
        }
        await sleep(400);

        // Verify
        await sleep(300);
        await click(step2Ref.current, 180);
        setVerifying(true);
        await sleep(1000);
        setVerifying(false);
        setVerified(true);
        await sleep(500);

        setCompletedSteps(new Set([1, 2]));
        await sleep(400);
        setActiveStep(3);
        await sleep(500);

        // STEP 3: Publish
        console.log('=== Step 3: Publish ===');
        scrollToStep(step3Ref);
        await sleep(700);
        setCursor(toPct(step3Ref.current));
        await sleep(500);
        await click(step3Ref.current, 250);

        setPublishing(true);
        const start = performance.now();
        const dur = 1600;
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / dur);
          setProgress(Math.round(p * 100));
          if (p < 1 && !cancelled) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        await sleep(dur + 100);

        setPublishing(false);
        setPublished(true);
        setCompletedSteps(new Set([1, 2, 3]));
        setCelebrating(true);

        await sleep(400);
        setShowMobilePreview(true);

        await sleep(800);
        setCelebrating(false);

        // Hold on published state
        await sleep(2800);
      }
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, [mounted, reduced, toPct, scrollToStep]);

  const theme = THEMES[themeIdx] || {
    id: 'indigo',
    name: 'Indigo',
    primary: '#6366f1',
    bg: '#eef2ff',
    accent: '#c7d2fe',
  };
  const getStepState = (step: number): StepState => {
    if (completedSteps.has(step)) return 'completed';
    if (activeStep === step) return 'active';
    return 'upcoming';
  };

  return (
    <div
      ref={containerRef}
      className="border-muted/60 bg-card/70 ring-muted/60 h-full w-full overflow-hidden rounded-2xl border shadow-xl ring-1 backdrop-blur"
    >
      {/* Main layout - responsive */}
      <div className="relative h-[calc(100%-42px)] w-full">
        {/* Mobile: Single column with conditional preview */}
        <div className="block h-full md:hidden">
          {!showMobilePreview ? (
            <section ref={leftRef} className="h-full overflow-y-auto p-4">
              <JourneySteps
                step1Ref={step1Ref}
                step2Ref={step2Ref}
                step3Ref={step3Ref}
                getStepState={getStepState}
                theme={theme}
                themeIdx={themeIdx}
                typedDomain={typedDomain}
                verifying={verifying}
                verified={verified}
                publishing={publishing}
                published={published}
                progress={progress}
                cursor={cursor}
                clicking={clicking}
                reduced={reduced}
              />
            </section>
          ) : (
            <section className="animate-in fade-in h-full overflow-hidden transition-opacity duration-700">
              <SitePreview
                theme={theme}
                domain={typedDomain || 'docs.yourco.com'}
                published={published}
                celebrating={celebrating}
                isMobileFullscreen={true}
              />
            </section>
          )}
        </div>

        {/* Desktop: Single column with conditional preview (same as mobile) */}
        <div className="hidden h-full md:block">
          {!showMobilePreview ? (
            <section ref={leftRef} className="h-full overflow-y-auto p-5">
              <JourneySteps
                step1Ref={step1Ref}
                step2Ref={step2Ref}
                step3Ref={step3Ref}
                getStepState={getStepState}
                theme={theme}
                themeIdx={themeIdx}
                typedDomain={typedDomain}
                verifying={verifying}
                verified={verified}
                publishing={publishing}
                published={published}
                progress={progress}
                cursor={cursor}
                clicking={clicking}
                reduced={reduced}
              />
            </section>
          ) : (
            <section className="animate-in fade-in pointer-events-none h-full overflow-hidden transition-opacity duration-700">
              <SitePreview
                theme={theme}
                domain={typedDomain || 'docs.yourco.com'}
                published={published}
                celebrating={celebrating}
                isMobileFullscreen={false}
              />
            </section>
          )}
        </div>
      </div>

      <style jsx>{`
        .cursor {
          transition:
            top 550ms cubic-bezier(0.25, 0.8, 0.25, 1),
            left 550ms cubic-bezier(0.25, 0.8, 0.25, 1),
            transform 180ms ease;
        }
        .cursor.clicking {
          transform: translate(-50%, -50%) scale(0.88);
        }
        @keyframes celebrate {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.06);
          }
        }
        .celebrating {
          animation: celebrate 700ms ease-in-out;
        }
      `}</style>
    </div>
  );
}

function JourneySteps({
  step1Ref,
  step2Ref,
  step3Ref,
  getStepState,
  theme,
  themeIdx,
  typedDomain,
  verifying,
  verified,
  publishing,
  published,
  progress,
  cursor,
  clicking,
  reduced,
}: {
  step1Ref: React.RefObject<HTMLDivElement | null>;
  step2Ref: React.RefObject<HTMLDivElement | null>;
  step3Ref: React.RefObject<HTMLDivElement | null>;
  getStepState: (step: number) => StepState;
  theme: ThemeSwatch;
  themeIdx: number;
  typedDomain: string;
  verifying: boolean;
  verified: boolean;
  publishing: boolean;
  published: boolean;
  progress: number;
  cursor: { top: number; left: number };
  clicking: boolean;
  reduced: boolean;
}) {
  return (
    <>
      <div className="pointer-events-none mb-6">
        <h3 className="mb-1 text-lg font-semibold">Publish your site</h3>
        <p className="text-muted-foreground text-sm">Three simple steps to go live</p>
      </div>

      <div className="relative space-y-6 pb-8">
        {/* Step 1: Theme */}
        <StepCard
          ref={step1Ref}
          stepNumber={1}
          state={getStepState(1)}
          icon={<Palette className="size-4" />}
          title="Choose theme"
          description="Pick a style for your help center"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map((t, i) => (
                <div
                  key={t.id}
                  className={`pointer-events-none relative rounded-lg border-2 transition-all duration-300 ${
                    i === themeIdx ? 'border-primary scale-105 shadow-md' : 'border-border/40'
                  }`}
                >
                  <div
                    className="aspect-[4/3] overflow-hidden rounded-md"
                    style={{ backgroundColor: t.bg }}
                  >
                    <div className="space-y-1 p-2">
                      <div
                        className="h-2 rounded"
                        style={{ backgroundColor: t.primary, width: '60%' }}
                      />
                      <div className="h-1.5 w-full rounded bg-black/10" />
                      <div className="h-1.5 w-4/5 rounded bg-black/10" />
                      <div className="h-1.5 w-3/5 rounded bg-black/10" />
                    </div>
                  </div>
                  <div className="px-1.5 py-1 text-center">
                    <span className="text-muted-foreground text-[10px] font-medium">{t.name}</span>
                  </div>
                  {i === themeIdx && (
                    <div className="bg-primary absolute -right-1.5 -top-1.5 rounded-full p-0.5">
                      <CheckCircle2 className="text-primary-foreground size-3" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            {getStepState(1) === 'completed' && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <CheckCircle2 className="text-primary size-4" />
                <span>{theme.name} theme selected</span>
              </div>
            )}
          </div>
        </StepCard>

        {/* Step 2: Domain */}
        <StepCard
          ref={step2Ref}
          stepNumber={2}
          state={getStepState(2)}
          icon={<Globe className="size-4" />}
          title="Connect domain"
          description="Add your custom domain"
        >
          <div className="space-y-3">
            <div className="relative">
              <label htmlFor="domain-input" className="sr-only">
                Domain name
              </label>
              <input
                id="domain-input"
                type="text"
                value={typedDomain || 'docs.yourco.com'}
                readOnly
                className="border-border bg-background pointer-events-none w-full rounded-md border px-3 py-2 font-mono text-sm"
              />
              {verifying && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Loader2 className="text-muted-foreground size-4 animate-spin" />
                </div>
              )}
              {verified && !verifying && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <CheckCircle2 className="text-primary size-4" />
                </div>
              )}
            </div>
            {verified && (
              <div className="bg-primary/5 border-primary/20 rounded-md border px-3 py-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="text-primary mt-0.5 size-4 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="text-foreground mb-0.5 font-medium">Domain verified</p>
                    <p className="text-muted-foreground">CNAME → cname.vercel-dns.com</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </StepCard>

        {/* Step 3: Publish */}
        <StepCard
          ref={step3Ref}
          stepNumber={3}
          state={getStepState(3)}
          icon={<Rocket className="size-4" />}
          title="Publish"
          description="Deploy your help center"
        >
          <div className="space-y-3">
            <button
              type="button"
              disabled
              className={`pointer-events-none flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                published
                  ? 'bg-primary/10 text-primary border-primary/30 border-2'
                  : publishing
                    ? 'bg-primary/80 text-primary-foreground'
                    : getStepState(3) === 'upcoming'
                      ? 'bg-muted/50 text-muted-foreground'
                      : 'bg-primary text-primary-foreground'
              }`}
            >
              {publishing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Publishing...
                </>
              ) : published ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Published
                </>
              ) : (
                <>
                  <Rocket className="size-4" />
                  Publish Site
                </>
              )}
            </button>

            {/* Progress bar */}
            {(publishing || published) && (
              <div className="space-y-1.5">
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-center text-xs">
                  {publishing ? 'Building and deploying...' : 'Site is live! 🎉'}
                </p>
              </div>
            )}
          </div>
        </StepCard>
      </div>

      {/* Cursor - only on desktop */}
      {!reduced && <Cursor top={cursor.top} left={cursor.left} clicking={clicking} />}
    </>
  );
}

const StepCard = React.forwardRef<
  HTMLDivElement,
  {
    stepNumber: number;
    state: StepState;
    icon: React.ReactNode;
    title: string;
    description: string;
    children: React.ReactNode;
  }
>(({ stepNumber, state, icon, title, description, children }, ref) => {
  const isExpanded = state === 'active' || state === 'completed';

  return (
    <div ref={ref} className="relative">
      {/* Connecting line */}
      {stepNumber < 3 && (
        <div
          className={`absolute left-[18px] top-[36px] h-6 w-0.5 transition-colors duration-500 ${
            state === 'completed' ? 'bg-primary' : 'bg-border'
          }`}
        />
      )}

      <div
        className={`pointer-events-none relative rounded-xl border-2 transition-all duration-500 ${
          state === 'active'
            ? 'border-primary bg-primary/5 ring-primary/10 shadow-lg ring-2'
            : state === 'completed'
              ? 'border-primary/30 bg-background'
              : 'border-border/40 bg-muted/20'
        }`}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4">
          {/* Step indicator */}
          <div
            className={`flex size-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-500 ${
              state === 'completed'
                ? 'bg-primary text-primary-foreground'
                : state === 'active'
                  ? 'bg-primary/20 text-primary ring-primary/30 ring-2'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {state === 'completed' ? <CheckCircle2 className="size-5" /> : stepNumber}
          </div>

          {/* Title & description */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <div
                className={`transition-colors duration-300 ${
                  state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'
                }`}
              >
                {icon}
              </div>
              <h4
                className={`font-semibold transition-colors duration-300 ${
                  state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'
                }`}
              >
                {title}
              </h4>
            </div>
            {!isExpanded && <p className="text-muted-foreground text-sm">{description}</p>}
          </div>
        </div>

        {/* Content */}
        <div
          className={`overflow-hidden transition-all duration-500 ${
            isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
});

function Cursor({ top, left, clicking }: { top: number; left: number; clicking: boolean }) {
  return (
    <div
      className={`cursor pointer-events-none absolute z-50 hidden md:block ${clicking ? 'clicking' : ''}`}
      style={{
        top: `${top}%`,
        left: `${left}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="bg-background/90 ring-primary/30 rounded-full p-1.5 shadow-lg ring-2">
        <MousePointerClick className="text-primary size-4" />
      </div>
    </div>
  );
}

function SitePreview({
  theme,
  domain,
  published,
  celebrating,
  isMobileFullscreen,
}: {
  theme: ThemeSwatch;
  domain: string;
  published: boolean;
  celebrating: boolean;
  isMobileFullscreen: boolean;
}) {
  return (
    <div
      className={`relative flex h-full flex-col items-center justify-center ${isMobileFullscreen ? 'p-4' : 'p-6'}`}
    >
      {/* Celebration effect */}
      {celebrating && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Sparkles className="text-primary size-20 animate-ping" />
          </div>
        </div>
      )}

      <div
        className={`w-full transition-all duration-700 ${
          isMobileFullscreen ? 'max-w-md' : 'max-w-sm'
        } ${celebrating ? 'celebrating' : ''}`}
      >
        {/* Browser chrome */}
        <div className="border-border/70 bg-muted/30 flex items-center gap-2 rounded-t-xl border border-b-0 px-3 py-2">
          <div className="flex gap-1.5">
            <div className="size-2 rounded-full bg-red-400/60" />
            <div className="size-2 rounded-full bg-amber-400/60" />
            <div className="size-2 rounded-full bg-emerald-400/60" />
          </div>
          <div
            className={`bg-background/50 text-muted-foreground mx-2 flex-1 truncate rounded-md px-3 py-1 font-mono ${
              published ? 'text-xs' : 'text-[10px]'
            }`}
          >
            {published ? `https://${domain}` : 'localhost:3000'}
          </div>
          {published && (
            <div className="size-2 flex-shrink-0 animate-pulse rounded-full bg-emerald-500" />
          )}
        </div>

        {/* Site preview */}
        <div
          className="border-border/70 rounded-b-xl border p-6 transition-all duration-700"
          style={{ backgroundColor: theme.bg }}
        >
          <div className="space-y-4">
            {/* Logo */}
            <div
              className="flex size-12 items-center justify-center rounded-lg font-bold text-white shadow-md transition-all duration-700"
              style={{ backgroundColor: theme.primary }}
            >
              YC
            </div>

            {/* Content */}
            <div className="space-y-2">
              <div
                className="h-8 rounded-md shadow-sm transition-all duration-700"
                style={{ backgroundColor: theme.primary, width: '70%' }}
              />
              <div className="space-y-1.5">
                <div className="h-3 rounded bg-black/10" />
                <div className="h-3 w-5/6 rounded bg-black/10" />
                <div className="h-3 w-4/6 rounded bg-black/10" />
              </div>
            </div>

            {/* CTA */}
            <div
              className="h-10 rounded-md shadow-md transition-all duration-700"
              style={{ backgroundColor: theme.primary, width: '40%' }}
            />

            {/* Cards */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="aspect-square space-y-2 rounded-lg p-3 shadow-sm transition-all duration-700"
                  style={{ backgroundColor: theme.accent }}
                >
                  <div
                    className="h-2 rounded"
                    style={{ backgroundColor: theme.primary, width: '60%' }}
                  />
                  <div className="h-1.5 rounded bg-black/10" />
                  <div className="h-1.5 w-3/4 rounded bg-black/10" />
                </div>
              ))}
            </div>
          </div>

          {/* Published badge */}
          {published && (
            <div className="bg-background/80 border-border/50 mt-4 flex items-center justify-center gap-2 rounded-full border px-3 py-2 shadow-md backdrop-blur-sm">
              <div className="size-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-foreground text-xs font-medium">Live on {domain}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
