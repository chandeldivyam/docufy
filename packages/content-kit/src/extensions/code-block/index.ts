import { mergeAttributes, type Extension } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import type { LowlightRoot } from 'lowlight/lib/core.js';
import { CodeBlockView } from './internal/CodeBlockView.js';

export type CreateCodeBlockOptions = {
  lowlight: LowlightRoot;
  header?: boolean;
  enableTabIndentation?: boolean;
  tabSize?: number;
  languageClassPrefix?: string;
  defaultLanguage?: string | null;
};

// Editor + Static share the same node spec/attrs
export function createCodeBlock(opts: CreateCodeBlockOptions) {
  const {
    lowlight,
    header = true,
    enableTabIndentation = true,
    tabSize = 2,
    languageClassPrefix = 'language-',
    defaultLanguage = null,
  } = opts;

  const Base = CodeBlockLowlight.configure({
    lowlight,
    enableLowlightHighlight: true,
    languageClassPrefix,
    defaultLanguage,
    enableTabIndentation,
    tabSize,
  }).extend({
    name: 'codeBlock',

    addAttributes() {
      const parent =
        (this as unknown as { parent?: () => Record<string, unknown> }).parent?.() ?? {};
      return {
        ...parent,
        language: {
          default: defaultLanguage,
          parseHTML: (element: HTMLElement) => {
            const code = element.querySelector('code');
            const cls = code?.getAttribute('class') ?? '';
            const m = cls.match(/(?:^|\s)language-([\w-]+)/);
            return m ? m[1] : defaultLanguage;
          },
          renderHTML: (attrs: { language?: string | null }) =>
            attrs?.language ? { 'data-language': attrs.language } : {},
        },
      };
    },

    renderHTML(args: { HTMLAttributes: Record<string, unknown> }) {
      const { HTMLAttributes } = args ?? {};
      // default node HTML if header is not desired
      if (!header) return ['pre', ['code', mergeAttributes(HTMLAttributes), 0]];

      // emit header + pre for static or SSR usage
      return [
        'div',
        { class: 'tt-codeblock-group' },
        [
          'div',
          { class: 'tt-codeblock-header', contentEditable: 'false' },
          [
            'div',
            { class: 'tt-codeblock-left' },
            [
              'span',
              {
                class: 'tt-codeblock-lang',
                'data-language': HTMLAttributes['data-language'] ?? '',
              },
              HTMLAttributes['data-language'] ?? 'auto',
            ],
          ],
          [
            'div',
            { class: 'tt-codeblock-right' },
            ['button', { class: 'tt-codeblock-copy', 'data-island': 'copy-button' }, 'Copy'],
          ],
        ],
        ['pre', { class: 'tt-codeblock-pre' }, ['code', mergeAttributes(HTMLAttributes), 0]],
      ];
    },

    addNodeView() {
      // Provide a React NodeView in editor mode when a header is desired
      if (header) {
        return ReactNodeViewRenderer(CodeBlockView, { contentDOMElementTag: 'code' });
      }
      return null;
    },
  });

  return Base;
}

// Separate editor-only NodeView so preset can include it conditionally
export const CodeBlockEditorView: Extension = CodeBlockLowlight.extend({
  name: 'codeBlockEditorView',
});

// Static variant that never provides a NodeView
export const StaticCodeBlock: Extension = CodeBlockLowlight.extend({
  name: 'codeBlock',
  addAttributes() {
    const parent = (this as unknown as { parent?: () => Record<string, unknown> }).parent?.() ?? {};
    return {
      ...parent,
      language: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const code = element.querySelector('code');
          const cls = code?.getAttribute('class') ?? '';
          const m = cls.match(/(?:^|\s)language-([\w-]+)/);
          return m ? m[1] : null;
        },
        renderHTML: (attrs: { language?: string | null }) =>
          attrs?.language ? { 'data-language': attrs.language } : {},
      },
    };
  },
  renderHTML(args: { HTMLAttributes: Record<string, unknown> }) {
    const { HTMLAttributes } = args ?? {};
    return [
      'div',
      { class: 'tt-codeblock-group' },
      [
        'div',
        { class: 'tt-codeblock-header', contentEditable: 'false' },
        [
          'div',
          { class: 'tt-codeblock-left' },
          [
            'span',
            {
              class: 'tt-codeblock-lang',
              'data-language': HTMLAttributes['data-language'] ?? '',
            },
            HTMLAttributes['data-language'] ?? 'auto',
          ],
        ],
        [
          'div',
          { class: 'tt-codeblock-right' },
          ['button', { class: 'tt-codeblock-copy', 'data-island': 'copy-button' }, 'Copy'],
        ],
      ],
      ['pre', { class: 'tt-codeblock-pre' }, ['code', mergeAttributes(HTMLAttributes), 0]],
    ];
  },
  addNodeView() {
    return null;
  },
});

export { CodeBlockView };
