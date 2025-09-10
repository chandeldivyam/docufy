'use client';

import { useEffect, useImperativeHandle, useState, forwardRef, useMemo, useRef } from 'react';

import { EditorProvider, useCurrentEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useTiptapSync } from '@convex-dev/prosemirror-sync/tiptap';
import { api } from '@/convex/_generated/api';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import AutoJoiner from 'tiptap-extension-auto-joiner';
import type { AnyExtension } from '@tiptap/core';
import CustomKeymap from './extensions/customKeymap';
// import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
// Import only the languages we want to support to keep bundle size small
import ts from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import { CodeBlockWithHeader } from './extensions/codeBlockWithHeader';

import { ResizableImage } from './extensions/resizableImage';
import ImageResizer from './ImageResizer';

import {
  createImageUpload,
  handleImageDrop,
  handleImagePaste,
  type UploadFn,
} from './plugins/uploadImages';
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
  // Create a Lowlight instance with only selected languages
  const lowlight = useMemo(() => {
    const l = createLowlight();

    l.register('typescript', ts);
    l.register('ts', ts);
    l.register('json', json);

    l.register('bash', bash);
    l.register('shell', bash);
    l.register('sh', bash);

    // HTML via the xml grammar; register both keys to support "html"
    l.register('xml', xml);
    l.register('html', xml);

    l.register('css', css);
    l.register('python', python);
    l.register('py', python);
    l.register('go', go);
    l.register('java', java);
    l.register('ruby', ruby);
    l.register('rb', ruby);
    l.register('php', php);
    l.register('c', c);
    l.register('cpp', cpp);
    l.register('rust', rust);
    l.register('rs', rust);
    l.register('sql', sql);
    l.register('yaml', yaml);
    l.register('yml', yaml);
    l.register('markdown', markdown);
    l.register('md', markdown);

    return l;
  }, []);

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
    const arr: (AnyExtension | null)[] = [
      StarterKit.configure({
        dropcursor: { color: '#DBEAFE', width: 4 },
        gapcursor: false,
        // Use our CodeBlockWithHeader instead of StarterKit's codeBlock
        codeBlock: false,
      }),
      ResizableImage,
      sync.extension as AnyExtension | null, // may be null early
      AutoJoiner,
      CustomKeymap,
      CodeBlockWithHeader.configure({
        lowlight,
        enableTabIndentation: true,
        tabSize: 2,
        languageClassPrefix: 'language-',
        defaultLanguage: null,
      }),
      editable ? (GlobalDragHandle as AnyExtension) : null,
    ];

    // Type predicate ensures the array is narrowed to AnyExtension[]
    return arr.filter((e): e is AnyExtension => e !== null);
  }, [editable, sync.extension, lowlight]);

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
