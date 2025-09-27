// apps/docs-renderer/components/TableOfContents.tsx
import * as React from 'react';

type TocItem = { level: number; text: string; id: string };

export default function TableOfContents({
  items,
  label = 'On this page',
  minLevel,
  variant = 'rail', // 'rail' | 'inline'
}: {
  items: TocItem[];
  label?: string;
  minLevel?: number; // if undefined, infer & clamp to >=2
  variant?: 'rail' | 'inline';
}) {
  if (!items?.length) return null;

  const inferredMin = Math.max(2, Math.min(...items.map((i) => i.level)));
  const base = minLevel ?? (Number.isFinite(inferredMin) ? inferredMin : 2);
  const filtered = items.filter((i) => i.level >= base);
  if (!filtered.length) return null;

  // data-toc is the hook for the spy; we render an "ink" element once.
  return (
    <nav aria-label={label} data-toc data-variant={variant} className="dfy-toc" role="navigation">
      <h2 className="sr-only" id="toc-heading">
        {label}
      </h2>
      <ol className="m-0 list-none p-0" aria-labelledby="toc-heading">
        {filtered.map((it) => (
          <li key={it.id} data-level={it.level}>
            <a href={`#${it.id}`}>{it.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
