'use client';

import { useState } from 'react';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { NAV_ITEMS } from '@/lib/nav';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={
        'border-sidebar-border bg-sidebar hidden shrink-0 flex-col border-r md:flex ' +
        (collapsed ? 'w-16' : 'w-64')
      }
    >
      <div className="border-sidebar-border border-b px-3 py-3">
        <div className="flex items-center gap-2">
          {collapsed ? (
            <button
              type="button"
              aria-label="Expand sidebar"
              className="hover:bg-sidebar-accent inline-flex h-8 w-8 items-center justify-center rounded-md"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          ) : (
            <>
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg">
                <span className="text-sm font-semibold">D</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sidebar-foreground truncate text-sm font-semibold">
                  Project
                </div>
                <div className="text-sidebar-foreground/70 truncate text-xs">Coming soon</div>
              </div>
              <button
                type="button"
                aria-label="Collapse sidebar"
                className="hover:bg-sidebar-accent ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md"
                onClick={() => setCollapsed(true)}
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        <nav aria-label="Primary" className="px-2">
          <SidebarNav items={NAV_ITEMS} collapsed={collapsed} />
        </nav>
      </div>

      <div className="border-sidebar-border mt-auto border-t p-3">
        {collapsed ? (
          <div className="flex items-center justify-center">
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <ThemeToggle />
            <LogoutButton />
          </div>
        )}
      </div>
    </aside>
  );
}
