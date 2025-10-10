import type { Manifest, Tree } from '@/lib/types';
import SidebarNavClient from '@/components/islands/SidebarNavClient';

export default function SidebarTree({
  manifest,
  tree,
  currentSpace,
  hrefPrefix,
}: {
  manifest: Manifest;
  tree: Tree;
  currentSpace: string;
  hrefPrefix: string;
}) {
  const selected = tree.spaces.find((s) => s.space.slug === currentSpace);
  const storageKey = `dfy:nav:${manifest.buildId}:${currentSpace}`;
  if (!selected) {
    return (
      <aside
        aria-label="Documentation sidebar"
        className="sticky top-0 flex h-svh flex-col gap-3 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-3 text-[var(--sidebar-fg)]"
      />
    );
  }
  return (
    <aside
      aria-label="Documentation sidebar"
      className="sticky flex flex-col gap-3 border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] p-3 text-[var(--sidebar-fg)]"
      // In tabs layout we offset by the combined height of the top bar + tabs to keep the sidebar aligned visually
      style={{
        top: 'var(--dfy-top-offset, 0px)',
        height: 'calc(100vh - var(--dfy-top-offset, 0px))',
      }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <SidebarNavClient nodes={selected.items} hrefPrefix={hrefPrefix} storageKey={storageKey} />
      </div>
    </aside>
  );
}
