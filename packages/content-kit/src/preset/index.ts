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
import Emoji, { gitHubEmojis } from '@tiptap/extension-emoji';
import suggestion from '../extensions/emoji/suggestion.js';
import { TableKit } from '@tiptap/extension-table';
import { HtmlComponent, StaticHtmlComponent } from '../extensions/html-component/index.js';
import { Tabs, Tab } from '../extensions/tabs/index.js';
import { Video, StaticVideo } from '../extensions/video/index.js';
import { UploadVideosExtension } from '../plugins/upload-videos.js';

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
    videoUploader?: (
      file: File,
      ctx: { orgSlug?: string; documentId: string },
    ) => Promise<{ url: string; width?: number; height?: number; poster?: string }>;
    context?: { orgSlug?: string; documentId?: string };
    validateFile?: (file: File) => boolean;
    validateVideoFile?: (file: File) => boolean;
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
    TableKit.configure({
      table: { resizable: true },
    }),
    Emoji.configure({
      emojis: gitHubEmojis,
      suggestion,
    }),
    Tabs,
    Tab,
  ];

  const extra = opts.extra ?? [];

  if (mode === 'editor') {
    return [
      ...base,
      createCodeBlock({ lowlight, header: true, enableTabIndentation: true }),
      ResizableImage,
      Video,
      UploadImagesExtension.configure({
        uploader: opts.upload?.uploader,
        context: opts.upload?.context,
        validateFile: opts.upload?.validateFile,
      }),
      UploadVideosExtension.configure({
        uploader: opts.upload?.videoUploader,
        context: opts.upload?.context,
        validateFile: opts.upload?.validateVideoFile,
      }),
      CustomKeymap,
      GlobalDragHandle,
      HtmlComponent,
      ...extra,
    ];
  }

  return [
    ...base,
    StaticCodeBlock.configure({ lowlight, enableLowlightHighlight: false }),
    StaticImage,
    StaticVideo,
    StaticHtmlComponent,
    ...extra,
  ];
}
