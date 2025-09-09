'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { NavItem, IconKey } from '@/lib/nav';
import { LayoutDashboard, Settings as SettingsIcon, type LucideIcon } from 'lucide-react';

export function SidebarNav({
  items,
  collapsed = false,
}: {
  items: readonly NavItem[];
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const iconMap: Record<IconKey, LucideIcon> = {
    dashboard: LayoutDashboard,
    settings: SettingsIcon,
  };

  return (
    <div className="space-y-1">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = iconMap[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              collapsed ? 'justify-center' : 'gap-3',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className={cn(collapsed ? 'sr-only' : 'truncate')}>{item.title}</span>
          </Link>
        );
      })}
    </div>
  );
}
