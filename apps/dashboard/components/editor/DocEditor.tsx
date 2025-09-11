'use client';

import { useEffect, useImperativeHandle, useState, forwardRef, useMemo, useRef } from 'react';

import { EditorProvider, useCurrentEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import type { AnyExtension } from '@tiptap/core';
import { useTiptapSync } from '@convex-dev/prosemirror-sync/tiptap';
import { api } from '@/convex/_generated/api';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import ImageResizer from './ImageResizer';

import { getExtensions } from '@docufy/content-kit/preset';
import {
  createImageUpload,
  handleImageDrop,
  handleImagePaste,
  type UploadFn,
} from '@docufy/content-kit/plugins/upload-images';
import '@docufy/content-kit/styles.css';

import { useMutation } from 'convex/react';
import { toast } from 'sonner';
import { Id } from '@/convex/_generated/dataModel';

type Props = {
  docKey: string;
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

const DocEditor = forwardRef<DocEditorHandle, Props>(function DocEditor(
  { docKey, className, editable }: Props,
  ref,
) {
  // Always call hooks in the same order
  const sync = useTiptapSync(api.editor, docKey, { snapshotDebounceMs: 1200 });
  const { isLoading, initialContent, create } = sync;
  const [editor, setEditor] = useState<Editor | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const storeFile = useMutation(api.files.store);

  // Only call create() once per docKey when we know there isn't a snapshot
  const createdRef = useRef(false);
  useEffect(() => {
    if (createdRef.current) return;
    if (isLoading) return;

    if (initialContent === null) {
      createdRef.current = true;
      // Use a stable, explicit empty paragraph
      create({
        type: 'doc',
        content: [{ type: 'paragraph', content: [] }],
      });
    }
  }, [isLoading, initialContent, create]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.chain().focus().run(),
      focusAtStart: () => editor?.chain().focus('start').run(),
      focusAtEnd: () => editor?.chain().focus('end').run(),
    }),
    [editor],
  );

  // Build UploadFn (keep hooks above any return)
  const uploadFn: UploadFn = useMemo(() => {
    const onUpload = async (file: File): Promise<string> => {
      const inner = (async () => {
        const uploadUrl = await generateUploadUrl({});
        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!res.ok) throw new Error('Upload failed');
        const { storageId } = (await res.json()) as { storageId: string };

        const { url } = await storeFile({
          storageId: storageId as unknown as Id<'_storage'>,
          contentType: file.type,
          name: file.name,
          size: file.size,
        });
        return url as string;
      })();

      void toast.promise(inner, {
        loading: 'Uploading image...',
        success: 'Image uploaded',
        error: 'Upload failed',
      });

      return await inner;
    };

    const validateFn = (file: File) => {
      const okType = file.type.startsWith('image/');
      const okSize = file.size / 1024 / 1024 <= 20;
      if (!okType) toast.error('File type not supported');
      if (!okSize) toast.error('File size too big (max 20MB)');
      return okType && okSize;
    };

    return createImageUpload({ validateFn, onUpload });
  }, [generateUploadUrl, storeFile]);

  const extensions: AnyExtension[] = useMemo(() => {
    const extra: (AnyExtension | null)[] = [
      sync.extension as AnyExtension | null,
      editable ? (GlobalDragHandle as AnyExtension) : null,
    ];
    return getExtensions('editor', {
      dropcursor: { color: '#DBEAFE', width: 4 },
      editable,
      extra: extra.filter((e): e is AnyExtension => !!e),
    });
  }, [editable, sync.extension]);

  // Render - no early return before hooks. Use conditional JSX instead.
  const notReady = sync.initialContent === null && !createdRef.current;

  return (
    <div className={className}>
      {notReady ? (
        <div className="text-muted-foreground p-2 text-sm">Creating page…</div>
      ) : (
        <div
          ref={scrollRef}
          className={['relative h-full overflow-auto', className].filter(Boolean).join(' ')}
        >
          <EditorProvider
            content={
              sync.initialContent ?? { type: 'doc', content: [{ type: 'paragraph', content: [] }] }
            }
            extensions={extensions}
            editable={editable}
            autofocus
            immediatelyRender={false}
            editorProps={{
              handlePaste: (view, event) =>
                handleImagePaste(view, event as ClipboardEvent, uploadFn),
              handleDrop: (view, event, _slice, moved) =>
                handleImageDrop(view, event as DragEvent, moved, uploadFn),
              attributes: {
                class:
                  'tiptap prose prose-sm sm:prose-base dark:prose-invert max-w-none h-full focus:outline-none',
              },
            }}
            // EditorProvider renders the editor content internally in v3
            slotAfter={
              <>
                <ImageResizer />
                <EditorBridge onReady={setEditor} />
              </>
            }
          />
        </div>
      )}
    </div>
  );
});

export default DocEditor;
