// apps/dashboard/app/dashboard/[projectId]/spaces/[spaceSlug]/doc/[documentId]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import { useQueryWithStatus } from '@/lib/convexHooks';
import { api } from '@/convex/_generated/api';
import DocEditor, { DocEditorHandle } from '@/components/editor/DocEditor';
import { Id } from '@/convex/_generated/dataModel';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getIconComponent } from '@/components/icons/iconOptions';
import dynamic from 'next/dynamic';
const IconPickerGrid = dynamic(
  () => import('@/components/icons/IconPicker').then((m) => m.IconPickerGrid),
  { ssr: false },
);

export default function DocEditorPage() {
  const params = useParams<{ documentId: string }>();
  const rawId = params.documentId as string;
  const decodedId = decodeURIComponent(rawId);

  const doc = useQueryWithStatus(api.documents.getDocument, {
    documentId: decodedId as unknown as Id<'documents'>,
  });

  const updateDoc = useMutation(api.documents.updateDocument);

  // All hooks must be defined before any early returns to preserve order.
  const editable = !!doc.data?.editable;

  // Title inline editing state (kept in sync with server data)
  const [title, setTitle] = useState(doc.data?.document?.title ?? '');
  useEffect(() => {
    setTitle(doc.data?.document?.title ?? '');
  }, [doc.data?.document?.title]);

  // Debounced autosave for title
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitTitleImmediate = useCallback(async () => {
    const next = title.trim();
    if (!editable) return;
    if (!next) {
      // Reset to previous value if empty attempt
      setTitle(doc.data?.document?.title ?? '');
      return;
    }
    if (next === doc.data?.document?.title) return;
    await updateDoc({ documentId: decodedId as unknown as Id<'documents'>, title: next });
  }, [title, editable, doc.data?.document?.title, updateDoc, decodedId, setTitle]);

  useEffect(() => {
    if (!editable) return;
    const next = title.trim();
    if (!next || next === doc.data?.document?.title) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void commitTitleImmediate();
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, editable, doc.data?.document?.title, commitTitleImmediate]);

  // Icon controls
  const currentIconName = doc.data?.document?.iconName as string | undefined;
  async function saveIcon(next: string) {
    if (!editable) return;
    await updateDoc({ documentId: decodedId as unknown as Id<'documents'>, iconName: next });
  }
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  // Editor ref must be declared before any early returns (hook order)
  const editorRef = useRef<DocEditorHandle | null>(null);

  // If navigating to an optimistic placeholder ID, avoid calling Convex
  if (decodedId.startsWith('optimistic:')) {
    return <div className="p-6">Creating page…</div>;
  }

  if (doc.status === 'pending') return <div className="p-6">Loading…</div>;
  if (doc.status === 'error') return <div className="p-6">Error loading document</div>;
  if (doc.data?.document?.type === 'group')
    return <div className="p-6">Groups are headers and can't be opened.</div>;

  // Safety: older rows may be missing pmsDocKey; backfill server-side if needed.
  const docKey = doc.data?.document?.pmsDocKey;
  if (!docKey) return <div className="p-6">This page is missing an editor key.</div>;

  return (
    <div className="p-0">
      <div className="group p-6 pb-0">
        {/* Icon area - reserved height to avoid overlap */}
        <div className={`mb-2 ${currentIconName || editable ? 'min-h-[3.5rem]' : ''}`}>
          {editable ? (
            <Dialog open={iconDialogOpen} onOpenChange={setIconDialogOpen}>
              {currentIconName ? (
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="hover:bg-muted/50 rounded-md p-1 transition-colors"
                    aria-label="Change icon"
                  >
                    {(() => {
                      const Icon = getIconComponent(currentIconName);
                      return <Icon className="h-16 w-16" />;
                    })()}
                  </button>
                </DialogTrigger>
              ) : (
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="invisible group-hover:visible">
                    Add icon
                  </Button>
                </DialogTrigger>
              )}
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Page icon</DialogTitle>
                  <DialogDescription>Choose an icon or remove it.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <IconPickerGrid
                    onSelect={async (name) => {
                      await saveIcon(name);
                      setIconDialogOpen(false);
                    }}
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        await saveIcon('');
                        setIconDialogOpen(false);
                      }}
                    >
                      Remove icon
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ) : currentIconName ? (
            // View-only state
            (() => {
              const Icon = getIconComponent(currentIconName);
              return <Icon className="h-16 w-16" />;
            })()
          ) : null}
        </div>

        {/* Title editable inline */}
        {editable ? (
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitleImmediate}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'ArrowDown') {
                e.preventDefault();
                void commitTitleImmediate();
                editorRef.current?.focusAtStart();
              }
            }}
            placeholder="Untitled"
            className="mb-1 h-auto border-none !bg-transparent p-0 py-0 text-4xl font-bold leading-tight shadow-none focus-visible:ring-0 sm:text-3xl md:!text-4xl lg:!text-5xl"
          />
        ) : (
          <h1 className="mb-1 text-4xl font-bold leading-tight sm:text-5xl md:text-5xl lg:text-6xl">
            {doc.data?.document.title}
          </h1>
        )}
      </div>
      <div className="p-6 pt-3">
        <DocEditor ref={editorRef} docKey={docKey} editable={doc.data?.editable} />
      </div>
    </div>
  );
}
