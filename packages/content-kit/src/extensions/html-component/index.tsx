import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import HtmlComponentView from './HtmlComponentView.js';

/**
 * TipTap node for authoring (editor) and static rendering (placeholder).
 * During publish, the renderer will transform the placeholder into
 * sanitized + scoped markup with inline <style>.
 */
const baseAttrs = {
  html: { default: '<div class="card">Hello</div>' },
  css: { default: `.card{padding:12px;border:1px solid #e5e7eb;border-radius:8px}` },
  display: { default: 'block' },
  scopeId: { default: null },
};

export const HtmlComponent = Node.create({
  name: 'htmlComponent',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return baseAttrs;
  },

  parseHTML() {
    return [{ tag: 'div[data-ctype="html-component"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    // In editor SSR this path is rarely used. Authoring uses NodeView.
    return ['div', mergeAttributes(HTMLAttributes, { 'data-ctype': 'html-component' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(HtmlComponentView);
  },
});

/**
 * Static variant: encodes data as attributes; the publish-time serializer
 * will sanitize, scope and minify it into final HTML/CSS.
 */
export const StaticHtmlComponent = Node.create({
  name: 'htmlComponent',
  group: 'block',
  atom: true,
  selectable: false,
  draggable: false,
  addAttributes() {
    return baseAttrs;
  },

  renderHTML({ node }) {
    const { html, css, display, scopeId } = node.attrs ?? {};
    const toB64 = (s: string) => Buffer.from(s ?? '', 'utf8').toString('base64');
    return [
      'div',
      {
        class: `dfy-htmlc dfy-htmlc--${display ?? 'block'}`,
        'data-cscope': scopeId ?? '',
        'data-raw-html': toB64(html ?? ''),
        'data-raw-css': toB64(css ?? ''),
        // the renderer will replace this placeholder
      },
      0,
    ];
  },
});
