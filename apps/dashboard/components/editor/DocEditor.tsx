// apps/dashboard/components/editor/DocEditor.tsx
'use client';

import { useEffect } from 'react';

import { EditorProvider, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useTiptapSync } from '@convex-dev/prosemirror-sync/tiptap';
import { api } from '@/convex/_generated/api';

type Props = {
  docKey: string; // e.g. "space/<spaceId>/doc/<documentId>"
  className?: string;
  editable?: boolean;
};

/**
 * Collaborative TipTap editor backed by Convex ProseMirror Sync.
 * - Loads initial snapshot if it exists.
 * - If no snapshot exists yet, offers a "Create" action with an empty doc.
 * - Syncs local changes as steps; server periodically stores snapshots.
 */
export default function DocEditor({ docKey, className, editable }: Props) {
  // Snapshot debounce reduces snapshot writes when users pause typing.
  const sync = useTiptapSync(api.editor, docKey, { snapshotDebounceMs: 1200 });

  useEffect(() => {
    if (sync.initialContent === null) {
      // Create with a minimal valid document structure - at least one paragraph
      sync.create({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [],
          },
        ],
      });
    }
  }, [sync, sync.initialContent, sync.create]);

  // No document created yet in the sync tables for this docKey
  if (sync.initialContent === null) {
    return <></>;
  }

  return (
    <EditorProvider
      content={sync.initialContent}
      // Important: include the sync extension alongside your TipTap extensions
      extensions={[StarterKit, sync.extension]}
      editorProps={{
        attributes: {
          class:
            'prose prose-sm sm:prose-base dark:prose-invert max-w-none h-full focus:outline-none',
        },
      }}
      editable={editable}
      autofocus
      immediatelyRender={false}
    >
      <div className={className}>
        <EditorContent editor={null} />
      </div>
    </EditorProvider>
  );
}
