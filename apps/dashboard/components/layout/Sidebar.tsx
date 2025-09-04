'use client';

import { useMemo, useState } from 'react';
import { SidebarNav } from '@/components/layout/SidebarNav';
import { getNavItems } from '@/lib/nav';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';

export function Sidebar({ projectId }: { projectId?: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const projectsData = useQuery(api.projects.listMine);
  const projects = useMemo(() => projectsData ?? [], [projectsData]);
  const params = useParams();
  const routeProjectId =
    typeof params?.projectId === 'string'
      ? (params.projectId as string)
      : Array.isArray(params?.projectId)
        ? (params.projectId[0] as string)
        : undefined;
  const pid = projectId ?? routeProjectId;

  const active = useMemo(() => {
    if (!pid) return null;
    return projects.find((p) => String(p._id) === String(pid)) ?? null;
  }, [projects, pid]);

  async function switchProject(id: string) {
    try {
      await fetch('/api/active-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      });
    } catch {
      console.error('Failed to switch project');
    }
    router.push(`/dashboard/${id}`);
  }

  const navItems = getNavItems(pid);
  const selectValue = active ? String(active._id) : undefined;

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
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                <span className="text-sm font-semibold">{active?.name?.charAt(0) ?? 'P'}</span>
              </div>
              <div className="ml-auto">
                <Select
                  key={pid ?? 'no-project'}
                  value={selectValue}
                  onValueChange={(val) => {
                    if (val === '__new__') router.push('/dashboard/onboarding/new-project');
                    else if (val) switchProject(val);
                  }}
                >
                  <SelectTrigger
                    aria-label="Switch project"
                    className="data-[size=sm] h-8 w-28 max-w-[10rem] sm:w-40"
                  >
                    <SelectValue
                      className="truncate"
                      placeholder={projects.length ? 'Switch project' : 'No projects'}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={String(p._id)} value={String(p._id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">+ New project…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <button
                type="button"
                aria-label="Collapse sidebar"
                className="hover:bg-sidebar-accent ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md"
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
          <SidebarNav items={navItems} collapsed={collapsed} />
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
