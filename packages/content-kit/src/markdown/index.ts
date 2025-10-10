// packages/content-kit/src/markdown/serialize.ts
import type { JSONContent } from '@tiptap/core';
import { renderToMarkdown } from '@tiptap/static-renderer/pm/markdown';
import { getExtensions } from '../preset/index.js';

/** Options you can tweak when generating Markdown */
export type MarkdownOptions = {
  /** Enable GitHub-Flavored Markdown styling decisions (tables/tasks mainly handled by defaults) */
  gfm?: boolean;
  /** Preferred fence when both are safe; will auto-switch if body contains that fence */
  codeFence?: '`' | '~';
  /** Append {#id} after headings for deterministic anchors */
  addHeadingIds?: boolean;
  /** How to emit code "title":  filename in info-string, Docusaurus metastring, or none */
  codeTitleStrategy?: 'filename' | 'title' | 'none';
  /** Extra guard to escape < > in plain text segments */
  escapeHtmlInText?: boolean;
};

/* ----------------------------- helpers ---------------------------------- */

const joinChildren = (c: string | string[] | undefined | null) =>
  Array.isArray(c) ? c.join('') : (c ?? '');

const safeTrim = (c: string | string[] | undefined | null) => joinChildren(c).trim();

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function fenceFor(body: string, prefer: '`' | '~'): { opener: string; closer: string } {
  const hasTicks = body.includes('```');
  const hasTildes = body.includes('~~~');
  if (prefer === '`') {
    return {
      opener: hasTicks && !hasTildes ? '~~~' : '```',
      closer: hasTicks && !hasTildes ? '~~~' : '```',
    };
  }
  return {
    opener: hasTildes && !hasTicks ? '```' : '~~~',
    closer: hasTildes && !hasTicks ? '```' : '~~~',
  };
}

function escapeAngleBrackets(text: string) {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ----------------------------- main API --------------------------------- */

export function toMarkdown(pmDoc: JSONContent | null, opts: MarkdownOptions = {}): string {
  const options: Required<MarkdownOptions> = {
    gfm: opts.gfm ?? true,
    codeFence: opts.codeFence ?? '`',
    addHeadingIds: opts.addHeadingIds ?? false,
    codeTitleStrategy: opts.codeTitleStrategy ?? 'filename',
    escapeHtmlInText: opts.escapeHtmlInText ?? false,
  };

  // Use *exactly* the same schema set you use for SSR HTML
  const extensions = getExtensions('static');
  const seenHeadingIds = new Set<string>();

  // Custom mappings—single-argument signature per Static Renderer NodeProps.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeMapping: Record<string, (ctx: { node: any; children?: string | string[] }) => string> =
    {
      /* ------------------------ Headings with optional {#id} ------------------------ */
      heading: ({ node, children }) => {
        const level = Math.max(1, Math.min(6, node.attrs?.level ?? 1));
        const hashes = '#'.repeat(level);
        let text = safeTrim(children);
        if (options.escapeHtmlInText) text = escapeAngleBrackets(text);
        const baseLine = `${hashes} ${text}`;
        const withId = (() => {
          if (!options.addHeadingIds) return baseLine;
          let id = slugify(node.textContent || text);
          if (!id) return baseLine;
          // de‑dupe (h, h → h, h-1, h-2…)
          let suffix = 0;
          while (seenHeadingIds.has(id)) id = `${id}-${++suffix}`;
          seenHeadingIds.add(id);
          return `${baseLine} {#${id}}`;
        })();
        return withId; // <— guarantees newline before and after headings
      },

      /* ------------------------ Code block with language/title ---------------------- */
      codeBlock: ({ node }) => {
        const lang = node.attrs?.language ?? '';
        const filename = node.attrs?.filename ?? node.attrs?.title ?? '';
        const raw = String(node.textContent ?? '');
        const { opener, closer } = fenceFor(raw, options.codeFence);

        let info = lang ? lang : '';
        if (filename) {
          if (options.codeTitleStrategy === 'filename') {
            info = info ? `${info} ${filename}` : filename;
          } else if (options.codeTitleStrategy === 'title') {
            const meta = `title="${String(filename).replace(/"/g, '\\"')}"`;
            info = info ? `${info} ${meta}` : meta;
          }
        }
        const infoLine = info ? `${opener}${info}` : opener;
        return `${infoLine}\n${raw}\n${closer}`;
      },

      /* ------------------------ Details → raw HTML (portable) ----------------------- */
      details: ({ children }) => {
        const body = safeTrim(children);
        return `<details>\n${body}\n</details>`;
      },

      /* ------------------------ Tabs / Tab → MDX-style JSX -------------------------- */
      // Tabs wraps already-rendered <Tab> children; enforce newline between siblings
      tabs: ({ children }) => {
        const inner = safeTrim(children)
          // ensure `</Tab>` is followed by a newline before the next `<Tab`
          .replace(/<\/Tab>\s*<Tab/g, '</Tab>\n<Tab');
        return `<Tabs>\n${inner}\n</Tabs>`;
      },

      // Each Tab panel prints itself with attributes and body
      tab: ({ node, children }) => {
        const title = String(node.attrs?.title ?? 'Tab').replace(/"/g, '\\"');
        const icon = node.attrs?.iconName
          ? ` icon="${String(node.attrs.iconName).replace(/"/g, '\\"')}"`
          : '';
        const body = safeTrim(children);
        // Inside Tabs we still add inner blank lines for MDX friendliness
        return `<Tab title="${title}"${icon}>\n${body}\n</Tab>`;
      },

      /* ------------------------ HTML Component placeholder -------------------------- */
      htmlComponent: ({ node }) => {
        const html = String(node.attrs?.html ?? '');
        const css = String(node.attrs?.css ?? '');
        const display = String(node.attrs?.display ?? 'block');
        const scopeId = String(node.attrs?.scopeId ?? 'noscope');
        const toB64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
        return `<div class="dfy-htmlc dfy-htmlc--${display}" data-raw-html="${toB64(html)}" data-raw-css="${toB64(css)}" data-cscope="${scopeId}"></div>`;
      },
      /* ------------------------ Fallbacks to avoid lost content --------------------- */
    };

  // Marks: rely on defaults; add overrides later if you need different emphasis/link syntax.

  const md = renderToMarkdown({
    extensions,
    content: pmDoc ?? { type: 'doc', content: [] },
    options: {
      nodeMapping,
    },
  });

  // Optional safety: escape stray '<' that could attach to preceding text
  return options.escapeHtmlInText ? md.replace(/<([^/a-z!]|$)/g, '&lt;$1') : md;
}
