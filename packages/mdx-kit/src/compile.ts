// packages/mdx-kit/src/compile.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeStringify from 'rehype-stringify';

import type { MdxRenderOptions, TocItem } from './types.js';
import { rehypeHandleMdxComponents } from './rehype-handle-mdx-components.js';
import { collectHeadings } from './rehype-collect-headings.js';
import { collectPlainText } from './rehype-collect-plain.js';
import { rehypeHighlightCode } from './rehype-highlight-code.js';

type HtmlResult = {
  html: string;
  toc: TocItem[];
  plain: string;
};

// We only need to pass through MDX JSX nodes, not all MDX node types.
const mdxJsxNodeTypes = ['mdxJsxFlowElement', 'mdxJsxTextElement'];

export async function renderMdxToHtml(
  markdown: string,
  opts: MdxRenderOptions = {},
): Promise<HtmlResult> {
  const toc: TocItem[] = [];
  const headingIds = new Set<string>();

  const allowHtml = opts.allowHtml ?? true;
  const enableGfm = opts.gfm ?? true;

  const processor = unified()
    .use(remarkParse)
    .use(enableGfm ? remarkGfm : () => {})
    .use(remarkMdx)
    .use(remarkRehype, {
      allowDangerousHtml: allowHtml,
      passThrough: mdxJsxNodeTypes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .use(rehypeHandleMdxComponents, { components: opts.components });

  if (allowHtml) {
    // Merge any remaining raw HTML into the tree now that MDX nodes are gone.
    processor.use(rehypeRaw);
  }

  processor
    .use(rehypeHighlightCode)
    .use(collectHeadings, { toc, headingIds })
    .use(rehypeAutolinkHeadings, {
      behavior: 'prepend',
      properties: {
        className: ['dfy-anchor'],
        ariaLabel: 'Permalink',
      },
    })
    .use(collectPlainText)
    .use(rehypeStringify, { allowDangerousHtml: false });

  const file = await processor.process(markdown);
  const html = String(file.value);
  const plain = (file.data.plainText as string | undefined) ?? '';

  return { html, toc, plain };
}
