'use client';

import { useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQueryWithStatus } from '@/lib/convexHooks';
import { api } from '@/convex/_generated/api';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PanelLeftClose, PanelLeftOpen, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  collapsed: boolean;
  projectId?: string;
  onToggleCollapsed: () => void;
};

export function ProjectHeader({ collapsed, projectId, onToggleCollapsed }: Props) {
  const router = useRouter();

  // Status-aware fetch, like SpacesList
  const projectsQuery = useQueryWithStatus(api.projects.listMine, {});
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const active = useMemo(() => {
    if (!projectId) return null;
    return projects.find((p) => String(p._id) === String(projectId)) ?? null;
  }, [projects, projectId]);

  const selectValue = active ? String(active._id) : undefined;

  const switchProject = useCallback(
    async (id: string) => {
      try {
        await fetch('/api/active-project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: id }),
        });
      } catch {
        // no-op: cookie is just a UX hint
      }
      router.push(`/dashboard/${id}`);
    },
    [router],
  );

  return (
    <div className="border-sidebar-border border-b px-3 py-3">
      <div className={cn('flex items-center gap-2', collapsed && 'justify-between')}>
        {collapsed ? (
          <>
            {/* Collapsed: show logo with hover overlay to uncollapse */}
            <button
              type="button"
              aria-label="Expand sidebar"
              className="group relative inline-flex h-8 w-8 items-center justify-center rounded-md"
              onClick={onToggleCollapsed}
            >
              {/* Logo always visible */}
              <span className="relative z-0 block h-6 w-6 transition-opacity duration-150 group-hover:opacity-0">
                <Image src="/logo.svg" alt="Logo" fill className="object-contain" />
              </span>
              {/* Hover overlay icon */}
              <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <PanelLeftOpen className="h-4 w-4" />
              </span>
            </button>
          </>
        ) : (
          <>
            {/* Logo replaces the single alphabet avatar */}
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg">
              {projectsQuery.isPending ? (
                <Skeleton className="h-5 w-5 rounded" />
              ) : (
                <span className="relative block h-6 w-6">
                  <Image src="/logo.svg" alt="Logo" fill className="object-contain" />
                </span>
              )}
            </div>

            {/* Project switcher or skeleton */}
            <div className="ml-auto w-40 sm:w-56">
              {projectsQuery.isPending ? (
                <Skeleton className="h-8 w-full rounded-md" />
              ) : (
                <Select
                  key={selectValue ?? 'no-project'}
                  value={selectValue}
                  onValueChange={(val) => {
                    if (val === '__new__') router.push('/dashboard/onboarding/new-project');
                    else if (val) switchProject(val);
                  }}
                >
                  <SelectTrigger aria-label="Switch project" className="h-8 max-w-[10rem]">
                    <SelectValue
                      className="truncate"
                      placeholder={projects.length ? 'Switch project' : 'No projects'}
                    />
                  </SelectTrigger>

                  {/* ↓ This line fixes the max width problem */}
                  <SelectContent
                    position="popper"
                    sideOffset={4}
                    className="max-h-[var(--radix-select-content-available-height)] max-w-[300px]"
                  >
                    {projects.map((p) => (
                      <SelectItem key={String(p._id)} value={String(p._id)}>
                        <span className="block max-w-full truncate">{p.name}</span>
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">+ New project…</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Collapse toggle */}
            <button
              type="button"
              aria-label="Collapse sidebar"
              className="hover:bg-sidebar-accent ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md"
              onClick={onToggleCollapsed}
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Gentle error only when expanded */}
      {!collapsed && projectsQuery.isError && (
        <Alert variant="destructive" className="mt-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Could not load projects. Pull to refresh or try again.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
