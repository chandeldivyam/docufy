// apps/docs-renderer/components/SpacesHeader.tsx
import Link from 'next/link';
import type { Manifest } from '../lib/types';

export default function SpacesHeader({
  manifest,
  currentSpace,
}: {
  manifest: Manifest;
  currentSpace: string;
}) {
  const spaces = manifest.nav.spaces.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (spaces.length <= 1) return <div className="dfy-brand">{manifest.site.name ?? 'Docs'}</div>;

  const isTabs = manifest.site.layout === 'sidebar-tabs';

  if (isTabs) {
    return (
      <nav className="dfy-tabs">
        {spaces.map((s) => (
          <Link
            key={s.slug}
            href={s.entry ?? `/${s.slug}`}
            prefetch
            className={s.slug === currentSpace ? 'active' : ''}
          >
            {s.name}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <div className="dfy-dropdown">
      <details>
        <summary>{spaces.find((s) => s.slug === currentSpace)?.name ?? 'Spaces'}</summary>
        <ul>
          {spaces.map((s) => (
            <li key={s.slug}>
              <Link href={s.entry ?? `/${s.slug}`} prefetch>
                {s.name}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
