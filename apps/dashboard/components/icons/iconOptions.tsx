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
  Search,
} from 'lucide-react';

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
  { name: 'Search', Icon: Search },
];

// Map for quick lookup by name
const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.name, o.Icon]),
);

export function getIconComponent(name?: string): LucideIcon {
  if (name && ICON_MAP[name]) return ICON_MAP[name];
  return FileText;
}

export function IconPickerGrid({
  onSelect,
  className = '',
  itemClassName = '',
}: {
  onSelect: (name: string) => void;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={`grid max-h-64 w-72 grid-cols-6 gap-2 overflow-y-auto p-2 ${className}`}>
      {ICON_OPTIONS.map(({ name, Icon }) => (
        <button
          key={name}
          onClick={() => onSelect(name)}
          className={`hover:bg-accent focus-visible:ring-ring/50 grid h-10 w-10 place-items-center rounded-md outline-none focus-visible:ring-2 ${itemClassName}`}
          title={name}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
