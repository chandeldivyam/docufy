import { renderToHTMLString } from '@tiptap/static-renderer';
import { JSONContent } from '@tiptap/core';
import { getExtensions } from '../preset/index.js';

type TocItem = { level: number; text: string; id: string };

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function textOf(node: JSONContent): string {
  if (!node) return '';
  if ('text' in node && typeof node.text === 'string') return node.text;
  const content = Array.isArray(node.content) ? node.content : [];
  return content.map(textOf).join('');
}

function extractToc(pm: JSONContent): TocItem[] {
  const toc: TocItem[] = [];
  const seen = new Set<string>();
  const walk = (n?: JSONContent) => {
    if (!n) return;
    if (n.type === 'heading') {
      const level = Math.min(Math.max(n.attrs?.level ?? 1, 1), 6);
      const text = textOf(n);
      let id = slugify(text) || `h${level}`;
      let suffix = 1;
      const base = id;
      while (seen.has(id)) id = `${base}-${suffix++}`;
      seen.add(id);
      toc.push({ level, text, id });
    }
    (n.content ?? []).forEach(walk);
  };
  walk(pm);
  return toc;
}

function addHeadingIds(html: string, toc: TocItem[]) {
  const map = new Map(toc.map((t) => [t.text, t.id]));
  return html.replace(/<h([1-6])([^>]*)>(.*?)<\/h\1>/g, (m, level, attrs, content) => {
    const plain = content.replace(/<[^>]*>/g, '');
    const id = map.get(plain);
    if (!id) return m;
    const withId = attrs.includes('id=') ? attrs : `${attrs} id="${id}"`;
    return `<h${level}${withId}>${content}</h${level}>`;
  });
}

export function serialize(pmDoc: JSONContent | null) {
  const extensions = getExtensions('static');
  let html = renderToHTMLString({ extensions, content: pmDoc ?? { type: 'doc', content: [] } });
  const toc = extractToc(pmDoc ?? { type: 'doc', content: [] });
  html = addHeadingIds(html, toc);

  // The docs-renderer can optionally scan for data-island attributes
  // and call island initializers from this package if present.
  return { html, toc };
}
