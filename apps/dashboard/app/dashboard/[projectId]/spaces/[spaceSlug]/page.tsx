// apps/dashboard/app/dashboard/[projectId]/spaces/[spaceSlug]/page.tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Id } from '@/convex/_generated/dataModel';
import { api } from '@/convex/_generated/api';
import { useQueryWithStatus } from '@/lib/convexHooks';

export interface DocumentTreeNode {
  _id: Id<'documents'>;
  type: 'page' | 'group';
  title: string;
  slug: string;
  rank: string;
  parentId?: Id<'documents'>;
  isHidden: boolean;
  pmsDocKey?: string;
  children: DocumentTreeNode[];
}

export default function SpaceLanding() {
  const params = useParams<{ projectId: string; spaceSlug: string }>();
  const router = useRouter();

  // Look up the space by project + slug if you add such query; or fetch via Spaces list and find by slug
  const spaces = useQueryWithStatus(api.spaces.list, {
    projectId: params.projectId as Id<'projects'>,
  });
  const space = spaces?.data?.find((s) => s.slug === params.spaceSlug);

  const tree = useQueryWithStatus(
    api.documents.getTreeForSpace,
    space ? { spaceId: space._id } : 'skip',
  );

  useEffect(() => {
    if (!space || !tree?.data) return;
    // Find first visible page in reading order
    const isOptimisticId = (id: unknown) => String(id).startsWith('optimistic:');
    const dfs = (nodes: DocumentTreeNode[]): DocumentTreeNode | null => {
      for (const n of nodes) {
        if (isOptimisticId(n._id)) continue; // skip optimistic placeholder nodes
        if (n.type === 'page' && !n.isHidden) return n;
        const childHit = n.children?.length ? dfs(n.children) : null;
        if (childHit) return childHit;
      }
      return null;
    };
    const first = dfs(tree.data);
    if (first) {
      router.replace(`/dashboard/${params.projectId}/spaces/${params.spaceSlug}/doc/${first._id}`);
    }
  }, [space, tree, params.projectId, params.spaceSlug, router]);

  return <div className="text-muted-foreground p-6">Select or create a page to get started.</div>;
}
