import StarterKit from '@tiptap/starter-kit';
import AutoJoiner from 'tiptap-extension-auto-joiner';
import type { AnyExtension } from '@tiptap/core';

import { lowlight } from '../lowlight/index.js';
import { createCodeBlock, StaticCodeBlock } from '../extensions/code-block/index.js';
import { ResizableImage, StaticImage } from '../extensions/image/index.js';
import CustomKeymap from '../extensions/custom-keymap/index.js';
import { UploadImagesExtension } from '../plugins/upload-images.js';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';

type Mode = 'editor' | 'static';

export type PresetOptions = {
  dropcursor?: { color?: string; width?: number };
  editable?: boolean; // unused here but reserved for future
  extra?: AnyExtension[];
  upload?: {
    uploader?: (
      file: File,
      ctx: { orgSlug?: string; documentId: string },
    ) => Promise<{ url: string; width?: number; height?: number }>;
    context?: { orgSlug?: string; documentId?: string };
    validateFile?: (file: File) => boolean;
  };
};

export function getExtensions(mode: Mode, opts: PresetOptions = {}) {
  const base = [
    StarterKit.configure({
      codeBlock: false,
      dropcursor: opts.dropcursor,
      gapcursor: false,
      undoRedo: false,
    }),
    AutoJoiner,
    Details.configure({
      persist: true,
      HTMLAttributes: {
        class: 'details',
      },
    }),
    DetailsSummary,
    DetailsContent,
    TaskItem.configure({
      nested: true,
    }),
    TaskList.configure({
      HTMLAttributes: {
        class: 'taskList',
      },
    }),
  ];

  const extra = opts.extra ?? [];

  if (mode === 'editor') {
    return [
      ...base,
      createCodeBlock({ lowlight, header: true, enableTabIndentation: true }),
      ResizableImage,
      UploadImagesExtension.configure({
        uploader: opts.upload?.uploader,
        context: opts.upload?.context,
        validateFile: opts.upload?.validateFile,
      }),
      CustomKeymap,
      GlobalDragHandle,
      ...extra,
    ];
  }

  return [...base, StaticCodeBlock.configure({ lowlight }), StaticImage, ...extra];
}
