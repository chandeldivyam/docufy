// apps/dashboard/app/dashboard/[projectId]/spaces/[spaceSlug]/doc/[documentId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useQueryWithStatus } from '@/lib/convexHooks';
import { api } from '@/convex/_generated/api';
import DocEditor from '@/components/editor/DocEditor';
import { Id } from '@/convex/_generated/dataModel';

export default function DocEditorPage() {
  const params = useParams<{ documentId: string }>();
  const doc = useQueryWithStatus(api.documents.getDocument, {
    documentId: params.documentId as Id<'documents'>,
  });

  if (doc.status === 'pending') return <div className="p-6">Loading…</div>;
  if (doc.status === 'error') return <div className="p-6">Error loading document</div>;
  if (doc.data?.document?.type === 'group')
    return <div className="p-6">Groups are headers and can’t be opened.</div>;

  // Safety: older rows may be missing pmsDocKey; backfill server-side if needed.
  const docKey = doc.data?.document?.pmsDocKey;
  if (!docKey) return <div className="p-6">This page is missing an editor key.</div>;

  return (
    <div className="p-0">
      <div className="border-b p-6 pb-3">
        <h1 className="mb-1 text-xl font-semibold">{doc.data?.document.title}</h1>
      </div>
      <div className="p-6">
        <DocEditor docKey={docKey} editable={doc.data?.editable} />
      </div>
    </div>
  );
}
