'use client';

import type { Manifest } from '@/lib/types';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function sortSpaces(manifest: Manifest) {
  return manifest.nav.spaces.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export default function SpaceTabs({
  manifest,
  hrefPrefix,
  currentSpace,
}: {
  manifest: Manifest;
  hrefPrefix: string;
  currentSpace: string;
}) {
  const pathname = usePathname();
  const spaces = sortSpaces(manifest);
  return (
    <div className="dfy-spaces-tabs" role="navigation" aria-label="Spaces">
      {spaces.map((s) => {
        const target = s.entry ?? `/${s.slug}`;
        const internalHref = `${hrefPrefix}${target}`;
        const isExternal = /^(https?:)?\/\//i.test(target);
        const isActive = s.slug === currentSpace;

        // If this is the active space, link to the current pathname to avoid re-navigation.
        const href = isActive ? pathname : isExternal ? target : internalHref;

        return (
          <Link
            prefetch
            key={s.slug}
            href={href}
            className="dfy-tab"
            aria-current={isActive ? 'page' : undefined}
            scroll={false}
            onClick={(e) => {
              // Extra guard: prevent navigation if already on the same route
              if (href === pathname) e.preventDefault();
            }}
          >
            {s.name}
          </Link>
        );
      })}
    </div>
  );
}
