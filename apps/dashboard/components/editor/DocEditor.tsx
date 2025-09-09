// apps/dashboard/components/editor/DocEditor.tsx
'use client';

import { useEffect, useImperativeHandle, useState, forwardRef } from 'react';

import { EditorProvider, EditorContent, useCurrentEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useTiptapSync } from '@convex-dev/prosemirror-sync/tiptap';
import { api } from '@/convex/_generated/api';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import AutoJoiner from 'tiptap-extension-auto-joiner';

type Props = {
  docKey: string; // e.g. "space/<spaceId>/doc/<documentId>"
  className?: string;
  editable?: boolean;
};

export type DocEditorHandle = {
  focus: () => void;
  focusAtStart: () => void;
  focusAtEnd: () => void;
};

function EditorBridge({ onReady }: { onReady: (editor: Editor | null) => void }) {
  const { editor } = useCurrentEditor();
  useEffect(() => {
    onReady(editor ?? null);
  }, [editor, onReady]);
  return null;
}

/**
 * Collaborative TipTap editor backed by Convex ProseMirror Sync.
 * - Loads initial snapshot if it exists.
 * - If no snapshot exists yet, offers a "Create" action with an empty doc.
 * - Syncs local changes as steps; server periodically stores snapshots.
 */
const DocEditor = forwardRef<DocEditorHandle, Props>(function DocEditor(
  { docKey, className, editable }: Props,
  ref,
) {
  // Snapshot debounce reduces snapshot writes when users pause typing.
  const sync = useTiptapSync(api.editor, docKey, { snapshotDebounceMs: 1200 });
  const [editor, setEditor] = useState<Editor | null>(null);

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

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        editor?.chain().focus().run();
      },
      focusAtStart: () => {
        editor?.chain().focus('start').run();
      },
      focusAtEnd: () => {
        editor?.chain().focus('end').run();
      },
    }),
    [editor],
  );

  // No document created yet in the sync tables for this docKey
  if (sync.initialContent === null) {
    return <></>;
  }

  // Configure extensions - matching Novel's approach
  const extensions = [
    StarterKit.configure({
      // Configure dropcursor for better drag feedback
      dropcursor: {
        color: '#DBEAFE',
        width: 4,
      },
      // Disable gapcursor as Novel does
      gapcursor: false,
    }),
    sync.extension,
    AutoJoiner,
  ];

  // Only add GlobalDragHandle for editable mode
  // This matches how Novel conditionally adds features
  if (editable) {
    extensions.push(GlobalDragHandle);
  }

  return (
    <EditorProvider
      content={sync.initialContent}
      extensions={extensions}
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
        <EditorBridge onReady={setEditor} />
      </div>
    </EditorProvider>
  );
});

export default DocEditor;
