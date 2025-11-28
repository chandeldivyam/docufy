// src/compile.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize from 'rehype-sanitize';

import type { MdxRenderOptions, TocItem } from './types.js';
import { remarkHandleMdxComponents } from './remark-handle-mdx-components.js';
import { collectHeadings } from './rehype-collect-headings.js';
import { collectPlainText } from './rehype-collect-plain.js';
import { createSanitizeSchema } from './sanitize.js';
import { rehypeHighlightCode } from './rehype-highlight-code.js';

type HtmlResult = {
  html: string;
  toc: TocItem[];
  plain: string;
};

export async function renderMdxToHtml(
  markdown: string,
  opts: MdxRenderOptions = {},
): Promise<HtmlResult> {
  const toc: TocItem[] = [];
  const headingIds = new Set<string>();

  const processor = unified().use(remarkParse).use(remarkMdx);

  if (opts.gfm ?? true) {
    processor.use(remarkGfm);
  }

  processor.use(remarkHandleMdxComponents, { components: opts.components }).use(remarkRehype, {
    allowDangerousHtml: opts.allowHtml ?? true,
  });

  if (opts.allowHtml ?? true) {
    processor.use(rehypeRaw);
  }

  processor
    // 1. Sanitize raw HTML first (trusted plugins run after this).
    .use(rehypeSanitize, createSanitizeSchema())
    .use(rehypeHighlightCode)
    // 2. Collect headings + assign IDs ourselves.
    .use(collectHeadings, { toc, headingIds })
    // 3. Add self-link anchors.
    .use(rehypeAutolinkHeadings, {
      behavior: 'prepend',
      properties: {
        className: ['dfy-anchor'],
        ariaLabel: 'Permalink', // camelCase; will serialize as aria-label
      },
    })
    .use(collectPlainText)
    .use(rehypeStringify, { allowDangerousHtml: false });

  const file = await processor.process(markdown);
  const html = String(file.value);
  const plain = (file.data.plainText as string | undefined) ?? '';

  return { html, toc, plain };
}
