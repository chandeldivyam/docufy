'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { CollaborativeEditorDemo } from './hero-collab-demo';

export function HeroSection() {
  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-12 sm:py-16 md:py-20">
      {/* Heading & copy */}
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-balance text-4xl tracking-tight sm:text-5xl">
          Build a{' '}
          <span className="from-primary to-primary/80 bg-gradient-to-r bg-clip-text text-transparent">
            blazing‑fast
          </span>{' '}
          help center your customers will love
        </h1>
        <p className="text-muted-foreground mt-4 text-pretty sm:text-lg">
          Collaborate in real‑time, publish instantly, and keep support content in lockstep with
          your product.
        </p>

        {/* CTAs */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="px-5 py-2.5">
            <a href="https://app.trydocufy.com" rel="noreferrer">
              Get started
            </a>
          </Button>
        </div>
      </div>

      {/* Demo */}
      <div className="mt-10 sm:mt-12">
        <div className="mx-auto w-full max-w-6xl">
          {/* Responsive height without aspect plugin */}
          <div className="mx-auto w-full [--panel-h:clamp(320px,55vh,620px)]">
            <CollaborativeEditorDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
