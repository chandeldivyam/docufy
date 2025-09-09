'use client';

import { useState } from 'react';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { SpacesList } from '@/components/layout/SpacesList';
import { getNavItems } from '@/lib/nav';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { Settings } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Id } from '@/convex/_generated/dataModel';
import { ProjectHeader } from '@/components/layout/ProjectHeader';

export function Sidebar({ projectId }: { projectId?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const params = useParams();

  const routeProjectId =
    typeof params?.projectId === 'string'
      ? (params.projectId as string)
      : Array.isArray(params?.projectId)
        ? (params.projectId[0] as string)
        : undefined;

  const pid = projectId ?? routeProjectId;

  const navItems = getNavItems(pid);

  return (
    <aside
      className={cn(
        'border-sidebar-border bg-sidebar hidden shrink-0 flex-col border-r md:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* New top header fetches projects and shows a skeleton locally */}
      <ProjectHeader
        collapsed={collapsed}
        projectId={pid}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
      />

      {/* Main navigation area */}
      <div className="flex-1 overflow-y-auto py-3">
        <nav aria-label="Primary" className="space-y-6">
          <div className="px-2">
            <SidebarNav items={navItems} collapsed={collapsed} />
          </div>

          {/* Spaces keep their own status-aware loading */}
          {pid && (
            <div className={cn(collapsed && 'px-1')}>
              <SpacesList projectId={pid as Id<'projects'>} collapsed={collapsed} />
            </div>
          )}
        </nav>
      </div>

      {/* Bottom section with settings, theme toggle, and logout */}
      <div className="border-sidebar-border mt-auto border-t">
        {pid && !collapsed && (
          <div className="border-sidebar-border border-b px-2 py-3">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-2 text-sm font-medium"
              onClick={() => router.push(`/dashboard/${pid}/settings`)}
            >
              <Settings className="h-4 w-4" />
              <span className="truncate">Settings</span>
            </Button>
          </div>
        )}
        <div className="p-3">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              {pid && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => router.push(`/dashboard/${pid}/settings`)}
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
              <ThemeToggle />
              <LogoutButton variant="icon" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <ThemeToggle />
              <LogoutButton />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
