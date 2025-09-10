'use client';

import React from 'react';
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic';

// A self-contained, lazily-loadable icon picker grid.
// Import this with next/dynamic where used to avoid pulling the full
// lucide dynamic import graph into every route bundle.

export function IconPickerGrid({
  onSelect,
  className = '',
  itemClassName = '',
  onRemove,
}: {
  onSelect: (name: string) => void;
  className?: string;
  itemClassName?: string;
  onRemove?: () => void;
}) {
  const [query, setQuery] = React.useState('');

  const filteredNames = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = iconNames as IconName[];
    if (!q) return list;
    return list.filter((n) => n.includes(q));
  }, [query]);

  return (
    <div className={className}>
      <div className="flex items-center gap-2 p-2">
        <input
          type="text"
          placeholder="Search icons (e.g., folder, book)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring/50 h-8 w-full rounded-md border px-2 text-xs outline-none focus-visible:ring-2"
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="hover:bg-accent text-muted-foreground hover:text-foreground h-8 shrink-0 rounded-md border px-3 text-xs"
          >
            Remove
          </button>
        )}
      </div>
      <div
        className={`grid max-h-72 w-full gap-2 overflow-y-auto p-2 [grid-template-columns:repeat(auto-fill,minmax(2.5rem,1fr))]`}
      >
        {filteredNames.map((name) => (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className={`hover:bg-accent focus-visible:ring-ring/50 grid h-10 w-full place-items-center rounded-md outline-none focus-visible:ring-2 ${itemClassName}`}
            title={name}
          >
            <LazyIconThumb name={name} className="h-5 w-5" />
          </button>
        ))}
      </div>
    </div>
  );
}

function LazyIconThumb({ name, className }: { name: IconName; className?: string }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: '100px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {visible ? (
        <DynamicIcon name={name} className={className} />
      ) : (
        <div className={`bg-muted h-full w-full rounded-sm`} />
      )}
    </div>
  );
}
