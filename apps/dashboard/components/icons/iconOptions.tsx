import dynamic from 'next/dynamic';
import type { LucideIcon } from 'lucide-react';

// NOTE: Keep this file lightweight and server-safe so that
// importing it doesn't pull in thousands of dynamic chunks.

// Default fallback icon name
const DEFAULT_ICON_PASCAL = 'FileText';

function toPascalCaseIconName(name?: string): string {
  if (!name) return DEFAULT_ICON_PASCAL;
  // If already PascalCase (roughly) just return
  if (/^[A-Z][A-Za-z0-9]*$/.test(name)) return name;
  // Convert kebab-case / snake_case / spaced to PascalCase
  const parts = String(name)
    .replace(/[_\s]+/g, '-')
    .split('-')
    .filter(Boolean);
  const pascal = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return pascal || DEFAULT_ICON_PASCAL;
}

// Cache dynamic components per name to avoid recreating on every call.
const CACHE = new Map<string, LucideIcon>();

// Returns a React component that lazy-loads lucide-react once and
// picks the requested icon from that module on the client only.
export function getIconComponent(name?: string): LucideIcon {
  const pascal = toPascalCaseIconName(name);
  const cached = CACHE.get(pascal);
  if (cached) return cached;
  const Comp = dynamic(
    async () => {
      const mod = (await import('lucide-react')) as typeof import('lucide-react');
      const C = (mod[pascal as keyof typeof mod] ??
        mod[DEFAULT_ICON_PASCAL as keyof typeof mod]) as unknown as LucideIcon;
      return C;
    },
    { ssr: false },
  ) as unknown as LucideIcon;
  CACHE.set(pascal, Comp);
  return Comp;
}
