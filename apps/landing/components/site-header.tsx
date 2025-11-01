'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Github, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SiteHeader() {
  const [scrolled, setScrolled] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const menuBtnRef = React.useRef<HTMLButtonElement>(null);
  const closeBtnRef = React.useRef<HTMLButtonElement>(null);
  const lastFocusedRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onReduce = () => setReduced(mq.matches);
    onReduce();
    mq.addEventListener?.('change', onReduce);

    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll);
    onScroll();

    return () => {
      mq.removeEventListener?.('change', onReduce);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Body scroll lock + Escape + focus restore
  React.useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    lastFocusedRef.current = document.activeElement as HTMLElement | null;

    // Capture current refs at mount time
    const menuBtn = menuBtnRef.current;
    const lastFocused = lastFocusedRef.current;

    const t = setTimeout(() => closeBtnRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);

      // Use captured values instead of .current
      menuBtn?.focus();
      if (!menuBtn && lastFocused) lastFocused.focus();
    };
  }, [open]);

  return (
    <header
      className="sticky z-50 mx-auto w-full max-w-7xl px-4 sm:px-6" // Add horizontal padding
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' }}
    >
      <div
        role="navigation"
        aria-label="Primary"
        className={[
          'flex h-12 items-center justify-between rounded-2xl border pr-4 ring-1 backdrop-blur transition-shadow sm:h-14',
          scrolled ? 'shadow-2xl' : 'shadow-xl',
          'bg-background/40 border-border/50 ring-border/50',
        ].join(' ')}
      >
        {/* brand */}
        <Link href="/" className="flex min-w-0 items-center gap-2 pl-2.5 sm:pl-3" aria-label="Home">
          <Image src="/logo.svg" alt="Docufy Logo" width={24} height={24} priority />
          <span className="sr-only font-semibold tracking-tight sm:not-sr-only sm:text-sm">
            Docufy
          </span>
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-1.5 sm:flex">
          <Link
            href="#features"
            className="text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary rounded-md px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
          >
            Features
          </Link>
          <Link
            href="#roadmap"
            className="text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary rounded-md px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
          >
            Roadmap
          </Link>

          <a
            href="https://docs.trydocufy.com"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:bg-muted/60 focus-visible:ring-primary rounded-md px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2"
          >
            Docs
          </a>

          <a
            href="https://github.com/chandeldivyam/docufy"
            target="_blank"
            rel="noreferrer"
            className="hover:bg-muted/60 text-muted-foreground focus-visible:ring-primary inline-flex h-9 w-9 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
            aria-label="GitHub repository"
          >
            <Github className="size-4" aria-hidden />
          </a>

          <Button asChild className="ml-1 px-3 py-1.5">
            <a href="https://app.trydocufy.com" target="_blank" rel="noreferrer">
              Dashboard <ArrowUpRight className="ml-1.5 size-3.5" aria-hidden />
            </a>
          </Button>
        </nav>

        {/* mobile actions - 44px tap targets */}
        <div className="flex items-center gap-1.5 pr-2.5 sm:hidden">
          <a
            href="https://github.com/chandeldivyam/docufy"
            target="_blank"
            rel="noreferrer"
            className="hover:bg-muted/60 text-muted-foreground focus-visible:ring-primary inline-flex h-10 w-10 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
            aria-label="GitHub repository"
          >
            <Github className="size-4" aria-hidden />
          </a>
          <button
            ref={menuBtnRef}
            type="button"
            className="hover:bg-muted/60 text-foreground focus-visible:ring-primary inline-flex h-10 w-10 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-controls="mobile-nav"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Mobile drawer - stays mounted so we can animate open/close */}
      <div
        id="mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-nav-title"
        aria-hidden={!open}
        className={[
          'fixed inset-0 z-[60] overflow-hidden transition-opacity sm:hidden', // Add overflow-hidden
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
          reduced ? 'duration-0' : 'duration-300',
        ].join(' ')}
      >
        {/* backdrop */}
        <div
          className={[
            'absolute inset-0 bg-black/40 transition-opacity',
            reduced ? 'duration-0' : 'duration-300',
          ].join(' ')}
          onClick={() => setOpen(false)}
        />

        {/* sheet */}
        <aside
          className={[
            'border-border/70 bg-card absolute inset-y-0 right-0 flex w-[min(85vw,320px)] flex-col rounded-l-2xl border-l p-3 shadow-2xl', // Simplified width, removed max-w
            'transition-transform',
            reduced ? 'duration-0' : 'duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            open ? 'translate-x-0' : 'translate-x-full',
          ].join(' ')}
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <h2 id="mobile-nav-title" className="text-sm font-semibold">
              Menu
            </h2>
            <button
              ref={closeBtnRef}
              type="button"
              className="hover:bg-muted/60 focus-visible:ring-primary inline-flex h-10 w-10 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <nav className="mt-1 flex-1 space-y-1.5">
            <Link
              href="#features"
              onClick={() => setOpen(false)}
              className="hover:bg-muted/60 block rounded-md px-3 py-2 text-sm"
            >
              Features
            </Link>
            <Link
              href="#roadmap"
              onClick={() => setOpen(false)}
              className="hover:bg-muted/60 block rounded-md px-3 py-2 text-sm"
            >
              Roadmap
            </Link>
            <a
              href="https://docs.trydocufy.com"
              target="_blank"
              rel="noreferrer"
              className="hover:bg-muted/60 block rounded-md px-3 py-2 text-sm"
            >
              Docs
            </a>
            <a
              href="https://github.com/chandeldivyam/docufy"
              target="_blank"
              rel="noreferrer"
              className="hover:bg-muted/60 flex items-center gap-2 rounded-md px-3 py-2 text-sm"
            >
              <Github className="size-4" aria-hidden /> GitHub
            </a>
          </nav>

          <div className="pt-1.5">
            <Button asChild className="w-full">
              <a href="https://app.trydocufy.com" target="_blank" rel="noreferrer">
                Go to Dashboard <ArrowUpRight className="ml-1.5 size-3.5" aria-hidden />
              </a>
            </Button>
          </div>
        </aside>
      </div>
    </header>
  );
}
