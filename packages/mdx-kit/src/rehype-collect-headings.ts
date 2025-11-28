// packages/mdx-kit/src/rehype-collect-headings.ts
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { toText as hastToText } from 'hast-util-to-text';
import type { TocItem } from './types.js';
import type { Element, Root } from 'hast';

type Options = {
  toc: TocItem[];
  headingIds: Set<string>;
};

export const collectHeadings: Plugin<[Options], Root> =
  ({ toc, headingIds }) =>
  (tree) => {
    visit(tree, 'element', (node: Element) => {
      const name = node.tagName;
      if (!/^h[1-6]$/.test(name)) return;

      const level = Number(name.slice(1));
      const text = hastToText(node);
      if (!text.trim()) return;

      // Check if the heading already has an id (might be set by user or earlier plugin)
      let id = (node.properties?.id as string | undefined) ?? slugify(text);

      // Ensure uniqueness
      const base = id;
      let suffix = 1;
      while (headingIds.has(id)) {
        id = `${base}-${suffix++}`;
      }
      headingIds.add(id);

      // Set the id on the node
      node.properties = node.properties || {};
      node.properties.id = id;

      toc.push({ level, text, id });
    });
  };

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}
