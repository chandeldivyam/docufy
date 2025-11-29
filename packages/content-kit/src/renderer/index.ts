import { renderToHTMLString } from '@tiptap/static-renderer';
import type { JSONContent } from '@tiptap/core';
import { getExtensions } from '../preset/index.js';

import * as cheerio from 'cheerio/slim'; // htmlparser2; no parse5
import { codeToHtml } from 'shiki';
import { decode as decodeEntities } from 'html-entities'; // or `he`
import { processScopedHtmlComponents } from './scoped-html.js';
export type TocItem = { level: number; text: string; id: string };
import { processTabsSSR } from './tabs-ssr.js';

function escapeHtml(s: string) {
  // Make idempotent: decode then escape once
  const d = decodeEntities(s);
  return d
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function preEscapeCodeBlocks(html: string) {
  return html.replace(
    /(<pre\b[^>]*\bclass="[^"]*\btt-codeblock-pre\b[^"]*"[^>]*>\s*<code\b[^>]*>)([\s\S]*?)(<\/code>)/gi,
    (_m, open, body, close) => open + escapeHtml(body) + close,
  );
}

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
    return `<h${level}${withId}><a class="dfy-anchor" href="#${id}" aria-label="Permalink"></a>${content}</h${level}>`;
  });
}

/**
 * AOT highlight all <pre.tt-codeblock-pre><code> blocks using Shiki.
 * Dual theme (light/dark) with 0 runtime JS.
 */
async function highlightWithShiki(html: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const $ = cheerio.load(html, { decodeEntities: true } as any, false);

  for (const el of $('div.tt-codeblock-group > pre.tt-codeblock-pre > code').toArray()) {
    const $code = $(el);

    // Lossless now, because the code was escaped before parsing
    const raw = $code.text();

    const hinted = ($code.attr('data-language') || '').trim();
    const lang =
      hinted ||
      (/^[-+].*$/m.test(raw)
        ? 'diff'
        : /<[A-Za-z]/.test(raw) && /\bclass(Name)?=/.test(raw)
          ? 'tsx'
          : 'text');

    const shikiHtml = await codeToHtml(raw, {
      lang,
      themes: { light: 'light-plus', dark: 'slack-dark' },
    });

    // Adopt Shiki nodes as before
    const $$ = cheerio.load(shikiHtml, undefined, false);
    const $shikiPre = $$('pre.shiki').first();
    const $shikiCode = $shikiPre.find('code').first();

    const $ourPre = $code.parent('pre.tt-codeblock-pre');
    const cls = $shikiPre.attr('class') || '';
    if (cls) $ourPre.addClass(cls);
    const style = $shikiPre.attr('style');
    if (style) $ourPre.attr('style', style);

    $code.empty();
    $shikiCode
      .contents()
      .get()
      .forEach((node) => {
        $code.append(node);
      });

    const incoming = $shikiCode.attr('class') || '';
    const current = $code.attr('class') || '';
    $code.attr('class', [current, incoming, 'shiki', `language-${lang}`].filter(Boolean).join(' '));
  }

  return $.html();
}

export async function serialize(pmDoc: JSONContent | null) {
  const extensions = getExtensions('static');
  let html = renderToHTMLString({ extensions, content: pmDoc ?? { type: 'doc', content: [] } });
  html = preEscapeCodeBlocks(html);

  const toc = extractToc(pmDoc ?? { type: 'doc', content: [] });
  html = addHeadingIds(html, toc);

  // AOT Shiki (dual-theme; async)
  html = await highlightWithShiki(html);
  html = await processScopedHtmlComponents(html);
  html = await processTabsSSR(html);

  return { html, toc };
}
