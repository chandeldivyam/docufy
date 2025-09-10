import { mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { CodeBlockView } from '../nodeviews/CodeBlockView';

export const CodeBlockWithHeader = CodeBlockLowlight.extend({
  name: 'codeBlock',

  addAttributes() {
    // keep any parent attributes without introspecting their structure
    const parent = (this as unknown as { parent?: () => Record<string, unknown> }).parent?.() ?? {};
    return {
      ...parent,
      language: {
        default: null, // set our own default, no parent peeking
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

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['pre', ['code', mergeAttributes(HTMLAttributes), 0]];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView, { contentDOMElementTag: 'code' });
  },
});
