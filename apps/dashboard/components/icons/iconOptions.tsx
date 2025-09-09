'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  FileText,
  Book,
  BookOpen,
  NotebookText,
  FileCode,
  Code2,
  Settings,
  Folder,
  Box,
  Package,
  Database,
  Server,
  Cpu,
  Globe,
  Link,
  Plug,
  Wrench,
  Hammer,
  Rocket,
  Lightbulb,
  Star,
  Sparkles,
  MessageSquare,
  MessagesSquare,
  Users,
  UserCog,
  ClipboardList,
  ListChecks,
  CheckCircle2,
  Calendar,
  BarChart3,
  LineChart,
  Layers,
  LayoutDashboard,
  Bug,
  ShieldCheck,
  Lock,
  Key,
} from 'lucide-react';
import { DynamicIcon, iconNames, type IconName } from 'lucide-react/dynamic';

export type IconOption = {
  name: string;
  Icon: LucideIcon;
};

// Curated set of icons to choose from
export const ICON_OPTIONS: IconOption[] = [
  { name: 'FileText', Icon: FileText },
  { name: 'Book', Icon: Book },
  { name: 'BookOpen', Icon: BookOpen },
  { name: 'NotebookText', Icon: NotebookText },
  { name: 'FileCode', Icon: FileCode },
  { name: 'Code2', Icon: Code2 },
  { name: 'Settings', Icon: Settings },
  { name: 'Folder', Icon: Folder },
  { name: 'Box', Icon: Box },
  { name: 'Package', Icon: Package },
  { name: 'Database', Icon: Database },
  { name: 'Server', Icon: Server },
  { name: 'Cpu', Icon: Cpu },
  { name: 'Globe', Icon: Globe },
  { name: 'Link', Icon: Link },
  { name: 'Plug', Icon: Plug },
  { name: 'Wrench', Icon: Wrench },
  { name: 'Hammer', Icon: Hammer },
  { name: 'Rocket', Icon: Rocket },
  { name: 'Lightbulb', Icon: Lightbulb },
  { name: 'Star', Icon: Star },
  { name: 'Sparkles', Icon: Sparkles },
  { name: 'MessageSquare', Icon: MessageSquare },
  { name: 'MessagesSquare', Icon: MessagesSquare },
  { name: 'Users', Icon: Users },
  { name: 'UserCog', Icon: UserCog },
  { name: 'ClipboardList', Icon: ClipboardList },
  { name: 'ListChecks', Icon: ListChecks },
  { name: 'CheckCircle2', Icon: CheckCircle2 },
  { name: 'Calendar', Icon: Calendar },
  { name: 'BarChart3', Icon: BarChart3 },
  { name: 'LineChart', Icon: LineChart },
  { name: 'Layers', Icon: Layers },
  { name: 'LayoutDashboard', Icon: LayoutDashboard },
  { name: 'Bug', Icon: Bug },
  { name: 'ShieldCheck', Icon: ShieldCheck },
  { name: 'Lock', Icon: Lock },
  { name: 'Key', Icon: Key },
];

// Map for quick lookup by name
const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.name, o.Icon]),
);

// Set of all available Lucide icon names (kebab-case)
const ALL_ICON_NAMES = iconNames as IconName[];
const ALL_ICON_NAME_SET = new Set<string>(ALL_ICON_NAMES as string[]);

// Default fallback icon name and component
const DEFAULT_ICON_NAME = 'file-text';

// Convert PascalCase or mixed-case names (e.g., FileText, Code2) to kebab-case (file-text, code-2)
function toKebabCaseIconName(name: string): string {
  return (
    name
      // Insert hyphen between lower/number and upper
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      // Insert hyphen between letter and number
      .replace(/([A-Za-z])([0-9])/g, '$1-$2')
      // Insert hyphen between number and letter
      .replace(/([0-9])([A-Za-z])/g, '$1-$2')
      .replace(/_{1,}/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase()
  );
}

// Resolve any incoming name (legacy PascalCase or kebab-case) to a valid lucide dynamic name
function resolveDynamicName(name?: string): IconName {
  if (!name) return DEFAULT_ICON_NAME as IconName;
  // Known curated map (legacy PascalCase)
  if (ICON_MAP[name]) {
    const kebab = toKebabCaseIconName(name);
    if (ALL_ICON_NAME_SET.has(kebab)) return kebab as IconName;
  }
  // If already a valid lucide kebab-case name
  if (ALL_ICON_NAME_SET.has(name)) return name as IconName;
  // Try converting PascalCase/mixed names
  const maybe = toKebabCaseIconName(name);
  if (ALL_ICON_NAME_SET.has(maybe)) return maybe as IconName;
  return DEFAULT_ICON_NAME as IconName;
}

export function getIconComponent(name?: string): LucideIcon {
  const resolved = resolveDynamicName(name);
  // Wrap DynamicIcon with a fixed name to match LucideIcon signature
  const Comp = React.forwardRef<SVGSVGElement, Omit<React.ComponentProps<'svg'>, 'name'>>(
    (props, ref) => <DynamicIcon ref={ref} name={resolved} {...props} />,
  ) as unknown as LucideIcon;
  return Comp;
}

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
    const list = ALL_ICON_NAMES;
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
        className={
          // Responsive, fills available width; virtual-ish via lazy thumbnails
          `grid max-h-72 w-full gap-2 overflow-y-auto p-2 [grid-template-columns:repeat(auto-fill,minmax(2.5rem,1fr))]`
        }
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
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
          }
        });
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
