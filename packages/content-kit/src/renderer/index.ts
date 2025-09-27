import { renderToHTMLString } from '@tiptap/static-renderer';
import type { JSONContent } from '@tiptap/core';
import { getExtensions } from '../preset/index.js';

import * as cheerio from 'cheerio/slim'; // htmlparser2; no parse5
import { codeToHtml } from 'shiki';
import { decode as decodeEntities } from 'html-entities'; // or `he`

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
    return `<h${level}${withId}><a class="dfy-anchor" href="#${id}" aria-label="Permalink"></a>${content}</h${level}>`;
  });
}

/**
 * AOT highlight all <pre.tt-codeblock-pre><code> blocks using Shiki.
 * Dual theme (light/dark) with 0 runtime JS.
 */
async function highlightWithShiki(html: string) {
  // Parse as fragment (no <html><body> wrappers)
  const $ = cheerio.load(html, undefined, false);

  const blocks = $('div.tt-codeblock-group > pre.tt-codeblock-pre > code').toArray();

  for (const el of blocks) {
    const $code = $(el);

    // --- Reconstruct RAW source robustly ---
    // 1) Get innerHTML as string (may contain real tags if parser reinterpreted text)
    const inner = $code.html() || '';

    // 2) Neutralize any tags into entities so everything becomes TEXT again
    //    (This also converts any already-escaped code safely to entities)
    const neutralized = inner.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // 3) Decode entities to get the literal code string with real "<" and ">"
    const raw = decodeEntities(neutralized);

    // Optional: language hinting (diff/tsx helps your snippets)
    const hinted = ($code.attr('data-language') || '').trim();
    const lang =
      hinted ||
      (/^[-+].*$/m.test(raw)
        ? 'diff'
        : /[<][A-Za-z]/.test(raw) && /\bclass(Name)?=/.test(raw)
          ? 'tsx'
          : 'text');

    const shikiHtml = await codeToHtml(raw, {
      lang,
      themes: { light: 'github-light', dark: 'github-dark' },
    });

    // Parse Shiki result as fragment and ADOPT nodes (no html string round-trips)
    const $$ = cheerio.load(shikiHtml, undefined, false);
    const $shikiPre = $$('pre.shiki').first();
    const $shikiCode = $shikiPre.find('code').first();

    const $ourPre = $code.parent('pre.tt-codeblock-pre');

    // Mirror Shiki classes & styles onto your <pre>
    const cls = $shikiPre.attr('class') || '';
    if (cls) $ourPre.addClass(cls);
    const style = $shikiPre.attr('style');
    if (style) $ourPre.attr('style', style);

    // Replace <code> contents by *adopting* nodes
    $code.empty();
    $shikiCode.contents().each((_, node) => {
      $code.append(node);
    });

    // Ensure classes on <code>
    const incoming = $shikiCode.attr('class') || '';
    const current = $code.attr('class') || '';
    $code.attr('class', [current, incoming, 'shiki', `language-${lang}`].filter(Boolean).join(' '));
  }

  return $.html();
}

export async function serialize(pmDoc: JSONContent | null) {
  const extensions = getExtensions('static');
  let html = renderToHTMLString({ extensions, content: pmDoc ?? { type: 'doc', content: [] } });

  const toc = extractToc(pmDoc ?? { type: 'doc', content: [] });
  html = addHeadingIds(html, toc);

  // AOT Shiki (dual-theme; async)
  html = await highlightWithShiki(html);

  return { html, toc };
}
