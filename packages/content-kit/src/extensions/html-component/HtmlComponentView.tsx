'use client';

import * as React from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import DOMPurify from 'dompurify';

/** Short, readable scope id (stable across same html+css) */
async function sha256(text: string) {
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const enc = new TextEncoder().encode(text);
    const buf = await window.crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf))
      .slice(0, 10)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // DJB2 fallback
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return (h >>> 0).toString(16);
}

/** Minimal tokens so preview resembles site surfaces (optional) */
const BASE_TOKENS_LIGHT = `
  :root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.18 0 0);
    --border: oklch(0.92 0 0);
    --card: var(--background);
  }
  body { background: var(--background); color: var(--foreground); }
`;

const BASE_TOKENS_DARK = `
  :root, html.dark {
    --background: oklch(0.17 0 0);
    --foreground: oklch(0.97 0 0);
    --border: oklch(0.28 0 0);
    --card: var(--background);
  }
  body { background: var(--background); color: var(--foreground); }
`;

/** Build safe, isolated srcdoc for the sandboxed preview iframe */
function buildSrcDoc({
  html,
  css,
  scopeId,
  dark,
}: {
  html: string;
  css: string;
  scopeId: string;
  dark: boolean;
}) {
  const safe = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'div',
      'section',
      'article',
      'header',
      'footer',
      'aside',
      'main',
      'p',
      'span',
      'strong',
      'em',
      'a',
      'ul',
      'ol',
      'li',
      'img',
      'table',
      'thead',
      'tbody',
      'tr',
      'td',
      'th',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
      'pre',
      'code',
      'details',
      'summary',
      'figure',
      'figcaption',
      'hr',
      'br',
      'input',
      'label',
    ],
    ALLOWED_ATTR: [
      'class',
      'id',
      'aria-*',
      'role',
      'title',
      'data-*',
      'style',
      'href',
      'target',
      'rel',
      'src',
      'alt',
      'width',
      'height',
      'loading',
      'decoding',
      'srcset',
      'sizes',
      'type',
      'name',
      'checked',
      'disabled',
      'for',
    ],
    ALLOW_DATA_ATTR: true,
  });
  const themeCSS = dark ? BASE_TOKENS_DARK : BASE_TOKENS_LIGHT;

  // Wrap user HTML in the same container we use at publish time.
  // We do NOT prefix their selectors here; the publish step does that.
  // The iframe guarantees isolation from the editor page styles.
  return [
    '<!doctype html><html',
    dark ? ' class="dark"' : '',
    '><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<style>',
    '*,*::before,*::after{box-sizing:border-box;}',
    themeCSS,
    // small, nice defaults
    `
      :root { --radius: 8px; }
      a{color:inherit}
      img,video,canvas,iframe{max-width:100%;height:auto;display:block}
      .card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:12px}
      [data-cscope]{contain: content; isolation: isolate;}
      body{margin:8px}
    `,
    '</style>',
    '<style>',
    css || '',
    '</style>',
    '</head><body>',
    `<div data-cscope="${scopeId}">`,
    safe,
    '</div>',
    '</body></html>',
  ].join('');
}

export default function HtmlComponentView(props: NodeViewProps) {
  const { node, updateAttributes, selected } = props;
  const attrs = (
    node as { attrs: { html: string; css: string; display: 'block' | 'full'; scopeId: string } }
  ).attrs;

  const [html, setHtml] = React.useState<string>(
    attrs.html ?? '<div class="card"><h3>Custom card</h3><p>Add content…</p></div>',
  );
  const [css, setCss] = React.useState<string>(
    attrs.css ?? `.card{padding:12px;border:1px solid #e5e7eb;border-radius:8px}`,
  );
  const [display] = React.useState<'block' | 'full'>(attrs.display ?? 'block');

  // UI state
  const [codeVisible, setCodeVisible] = React.useState(true);
  const initialDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const [dark, setDark] = React.useState<boolean>(initialDark);

  // Debounced attribute updates to avoid flooding transactions
  const pending = React.useRef<number | null>(null);
  const commitAttrs = React.useCallback(
    async (h: string, c: string) => {
      const scopeId = await sha256(`${h}\n/*split*/\n${c}`);
      updateAttributes({ html: h, css: c, display, scopeId });
    },
    [updateAttributes, display],
  );

  React.useEffect(() => {
    if (pending.current) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      commitAttrs(html, css);
    }, 220);
    return () => {
      if (pending.current) window.clearTimeout(pending.current);
    };
  }, [html, css, commitAttrs]);

  // Recompute scope id for preview (same logic as persisted)
  const [scopeId, setScopeId] = React.useState<string>(attrs.scopeId ?? '');
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const s = await sha256(`${html}\n/*split*/\n${css}`);
      if (alive) setScopeId(s);
    })();
    return () => {
      alive = false;
    };
  }, [html, css]);

  // Build srcdoc any time inputs change
  const srcdoc = React.useMemo(
    () => buildSrcDoc({ html, css, scopeId, dark }),
    [html, css, scopeId, dark],
  );

  return (
    <NodeViewWrapper
      as="div"
      className={`dfy-htmlc-editor ${selected ? 'is-selected' : ''}`}
      style={{
        border: '1px solid var(--border, #e5e7eb)',
        borderRadius: 8,
        padding: 8,
        margin: '12px 0',
        background: 'var(--sidebar-bg, transparent)',
      }}
      contentEditable={false}
      data-ctype="html-component"
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setCodeVisible((v) => !v)}
            aria-pressed={!codeVisible}
            title={codeVisible ? 'Hide code' : 'Show code'}
            style={{
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {codeVisible ? 'Hide Code' : 'Show Code'}
          </button>

          <button
            type="button"
            onClick={() => setDark((v) => !v)}
            aria-pressed={dark}
            title="Toggle dark mode preview"
            style={{
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {dark ? '🌞' : '🌛'}
          </button>
        </div>
      </div>

      {/* Dual‑pane code editors */}
      {codeVisible && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div>
            <label style={{ fontSize: 12, color: '#334155' }}>HTML</label>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={10}
              spellCheck={false}
              style={{
                width: '100%',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: 8,
                resize: 'vertical',
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#334155' }}>CSS (no @import / no JS)</label>
            <textarea
              value={css}
              onChange={(e) => setCss(e.target.value)}
              rows={10}
              spellCheck={false}
              style={{
                width: '100%',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: 8,
                resize: 'vertical',
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom preview (isolated) */}
      <iframe
        sandbox="" /* strict: no scripts, forms, same-origin, etc. */
        srcDoc={srcdoc}
        style={{
          width: '100%',
          minHeight: 360,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          background: 'white',
        }}
        aria-label="Component preview (sandboxed)"
      />
    </NodeViewWrapper>
  );
}
