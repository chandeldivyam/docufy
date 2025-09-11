import StarterKit from '@tiptap/starter-kit';
import AutoJoiner from 'tiptap-extension-auto-joiner';
import type { AnyExtension } from '@tiptap/core';

import { lowlight } from '../lowlight/index.js';
import { createCodeBlock, StaticCodeBlock } from '../extensions/code-block/index.js';
import { ResizableImage, StaticImage } from '../extensions/image/index.js';

type Mode = 'editor' | 'static';

export type PresetOptions = {
  dropcursor?: { color?: string; width?: number };
  editable?: boolean; // unused here but reserved for future
  extra?: AnyExtension[];
};

export function getExtensions(mode: Mode, opts: PresetOptions = {}) {
  const base = [
    StarterKit.configure({
      codeBlock: false,
      dropcursor: opts.dropcursor,
      gapcursor: false,
    }),
    AutoJoiner,
  ];

  const extra = opts.extra ?? [];

  if (mode === 'editor') {
    return [
      ...base,
      createCodeBlock({ lowlight, header: true, enableTabIndentation: true }),
      ResizableImage,
      ...extra,
    ];
  }

  return [...base, StaticCodeBlock.configure({ lowlight }), StaticImage, ...extra];
}
