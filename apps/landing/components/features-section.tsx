'use client';

import * as React from 'react';
import { WebRealtimePanel } from './features/web-realtime-panel';
import { PublishJourneyPanel } from './features/publish-journey-panel';

export function FeaturesSection() {
  return (
    <>
      {/* Existing WebRealtime section */}
      <section
        id="features"
        className="relative mx-auto w-full max-w-6xl px-4 py-3 sm:py-5"
        aria-labelledby="feature-web-title"
      >
        <h2
          id="feature-web-title"
          className="mb-5 text-balance text-2xl tracking-tight sm:text-3xl"
        >
          🚀 We deeply care about performance
        </h2>
        <div className="bg-muted/40 grid gap-10 rounded-2xl p-6 md:grid-cols-2 md:items-center">
          <div>
            <h2 id="feature-web-title" className="text-balance text-2xl tracking-tight sm:text-3xl">
              Blazing fast web - zero spinners
            </h2>
            <p className="text-muted-foreground mt-4">
              For teams who deeply care about performance, our collaborative editor is local-first,
              real-time, and ready for human or AI edits. Try it{' '}
              <a
                className="decoration-primary/40 hover:decoration-primary underline underline-offset-4"
                href="https://app.trydocufy.com"
                rel="noreferrer"
                target="_blank"
              >
                here
              </a>
              .
            </p>
          </div>

          <div className="mx-auto w-full [--panel-h:clamp(360px,54vh,620px)]">
            <div className="h-[var(--panel-h)]">
              <WebRealtimePanel />
            </div>
          </div>
        </div>
      </section>

      {/* NEW: Publish journey */}
      <PublishSection />
    </>
  );
}

export function PublishSection() {
  return (
    <section
      id="publish"
      className="relative mx-auto w-full max-w-6xl px-4 py-3 sm:py-5"
      aria-labelledby="feature-publish-title"
    >
      <div className="bg-muted/40 grid gap-10 rounded-2xl p-6 md:grid-cols-2 md:items-center">
        <div>
          <h2
            id="feature-publish-title"
            className="text-balance text-2xl tracking-tight sm:text-3xl"
          >
            One‑click publish
          </h2>
          <p className="text-muted-foreground mt-4">
            Pick a theme, connect a domain, and publish. Your help center goes live—instantly.
          </p>
        </div>

        {/* Right: live panel demo */}
        <div className="mx-auto w-full [--panel-h:clamp(420px,60vh,640px)]">
          <div className="h-[var(--panel-h)] md:h-[var(--panel-h)]">
            <PublishJourneyPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
