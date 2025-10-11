'use client';

import { useState } from 'react';
import type { Manifest, Tree } from '@/lib/types';
import ThemeToggle from '@/components/islands/ThemeToggle';
import SearchIconButton from '@/components/search/SearchIconButton';
import SearchTrigger from '@/components/search/SearchTrigger';
import Logo from '@/components/Logo';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { MoreVertical } from 'lucide-react'; // or your icon library

function NavLinkButton({
  btn,
  hrefPrefix,
}: {
  btn: { id: string; label: string; href: string; target?: '_self' | '_blank' };
  hrefPrefix: string;
}) {
  const isExternal = /^(https?:)?\/\//i.test(btn.href);
  const href = isExternal ? btn.href : `${hrefPrefix}${btn.href}`;
  return (
    <Button key={btn.id} variant="ghost" size="sm" className="dfy-topbar-button h-9" asChild>
      <Link
        prefetch={!isExternal}
        href={href}
        target={btn.target ?? (isExternal ? '_blank' : undefined)}
        rel={btn.target === '_blank' || isExternal ? 'noopener noreferrer' : undefined}
      >
        {btn.label}
      </Link>
    </Button>
  );
}

export default function TopBar({
  manifest,
  tree,
  hrefPrefix,
}: {
  manifest: Manifest;
  tree: Tree;
  hrefPrefix: string;
}) {
  const [mobileButtonsOpen, setMobileButtonsOpen] = useState(false);

  return (
    <div className="dfy-topbar">
      <div className="dfy-topbar-inner">
        <div className="dfy-topbar-left">
          <label
            htmlFor="dfy-mobile-nav-toggle"
            className="dfy-hamburger lg:hidden"
            aria-label="Open navigation"
            role="button"
            tabIndex={0}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M3 6h18M3 12h18M3 18h18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </label>
          <Logo manifest={manifest} hrefPrefix={hrefPrefix} />
        </div>

        <div className="dfy-topbar-center">
          {/* Desktop: keep search centered */}
          <div className="hidden md:block">
            <SearchTrigger />
          </div>
        </div>

        <div className="dfy-topbar-right">
          {/* Mobile: show search icon on the right */}
          <div className="md:hidden">
            <SearchIconButton />
          </div>
          {tree.buttons?.topbar_right?.map((b) => (
            <NavLinkButton key={b.id} btn={b} hrefPrefix={hrefPrefix} />
          ))}

          {/* Mobile buttons menu trigger */}
          <button
            onClick={() => setMobileButtonsOpen(!mobileButtonsOpen)}
            className="dfy-mobile-buttons-trigger hover:bg-var(--sidebar-hover) rounded-lg p-2 transition-colors md:hidden"
            aria-label="More options"
          >
            <MoreVertical className="h-5 w-5" />
          </button>

          <ThemeToggle />
        </div>

        {/* Mobile buttons dropdown */}
        {mobileButtonsOpen && tree.buttons?.topbar_right && (
          <>
            <div
              className="fixed inset-0 z-50"
              onClick={() => setMobileButtonsOpen(false)}
              aria-hidden="true"
            />
            <div className="dfy-mobile-buttons-menu">
              {tree.buttons.topbar_right.map((btn) => {
                const isExternal = /^(https?:)?\/\//i.test(btn.href);
                const href = isExternal ? btn.href : `${hrefPrefix}${btn.href}`;
                return (
                  <Link
                    key={btn.id}
                    href={href}
                    onClick={() => setMobileButtonsOpen(false)}
                    target={btn.target ?? (isExternal ? '_blank' : undefined)}
                  >
                    {btn.label}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
