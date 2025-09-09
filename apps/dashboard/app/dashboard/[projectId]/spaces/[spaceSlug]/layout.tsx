// apps/dashboard/app/dashboard/[projectId]/spaces/[spaceSlug]/layout.tsx
'use client';

import { ReactNode } from 'react';
import { SpaceSidebar } from '@/components/space/SpaceSidebar';

export default function SpaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full">
      <aside className="w-72 shrink-0 border-r">
        <SpaceSidebar />
      </aside>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
