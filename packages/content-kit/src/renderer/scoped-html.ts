import * as cheerio from 'cheerio/slim';
import sanitizeHtml from 'sanitize-html';
import postcss, { type AtRule, type Declaration, type Plugin } from 'postcss';
import prefixSelector from 'postcss-prefix-selector';
import cssnano from 'cssnano';

/** HTML allowlist for user components */
const HTML_SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
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
  allowedAttributes: {
    '*': ['class', 'id', 'aria-*', 'role', 'title', 'data-*', 'style'], // style will still be filtered by CSS sanitizer below.
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes'],
    input: ['type', 'name', 'id', 'checked', 'disabled'],
    label: ['for'],
  },
  allowedSchemes: ['https', 'data', 'mailto'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const rel = new Set((attribs.rel ?? '').split(/\s+/).filter(Boolean));
      rel.add('noopener');
      rel.add('nofollow');
      return { tagName, attribs: { ...attribs, rel: Array.from(rel).join(' ') } };
    },
    img: (tag, a) => ({
      tagName: 'img',
      attribs: { ...a, loading: a.loading ?? 'lazy', decoding: a.decoding ?? 'async' },
    }),
  },
};

/** PostCSS plugins to remove dangerous bits before scoping/minifying */
const removeDangerousAtRules = (): Plugin => {
  return {
    postcssPlugin: 'dfy-remove-dangerous-at-rules',
    AtRule: {
      import: (at: AtRule) => {
        at.remove();
      },
      document: (at: AtRule) => {
        at.remove();
      },
      charset: (at: AtRule) => {
        at.remove();
      },
      namespace: (at: AtRule) => {
        at.remove();
      },
    },
  };
};
removeDangerousAtRules.postcss = true;

const sanitizeDeclarations = (): Plugin => {
  const DISALLOWED_PROPS = new Set(['behavior', '-ms-behavior', 'expression', 'filter']);
  return {
    postcssPlugin: 'dfy-sanitize-declarations',
    Declaration(decl: Declaration) {
      const prop = String(decl.prop || '').toLowerCase();
      const value = String(decl.value || '');
      if (DISALLOWED_PROPS.has(prop)) {
        decl.remove();
      }
      if (prop === 'position' && /\bfixed\b/i.test(value)) {
        decl.remove();
      }
    },
  };
};
sanitizeDeclarations.postcss = true;

async function scopeAndMinify(css: string, scope: string) {
  const prefix = `[data-cscope="${scope}"]`;
  const result = await postcss([
    removeDangerousAtRules(),
    sanitizeDeclarations(),
    prefixSelector({
      prefix,
      transform: (prefixSel: string, sel: string) => {
        return `${prefixSel} ${sel}`;
      },
    }),
    cssnano({ preset: 'default' }),
  ]).process(css, { from: undefined });
  return result.css;
}

/** Decode base64 attributes safely */
function fromB64(s: string): string {
  try {
    return Buffer.from(String(s || ''), 'base64').toString('utf8');
  } catch {
    return '';
  }
}

/** Replace placeholder nodes with sanitized, scoped markup */
export async function processScopedHtmlComponents(html: string) {
  const $ = cheerio.load(html, undefined, false);

  const nodes = $('.dfy-htmlc[data-raw-html]');
  if (!nodes.length) return html;

  // Process each block in sequence
  for (const el of nodes.toArray()) {
    const $el = $(el);
    const rawHtml = fromB64($el.attr('data-raw-html') || '');
    const rawCss = fromB64($el.attr('data-raw-css') || '');
    const scope = ($el.attr('data-cscope') || '').trim() || 'noscope';

    // 1) sanitize HTML first (no scripts, safe attrs)
    const safeHtml = sanitizeHtml(rawHtml, HTML_SANITIZE);

    // 2) sanitize + prefix + minify CSS
    const safeScopedCss = await scopeAndMinify(rawCss, scope);

    // 3) Replace placeholder with final block
    const wrapperAttrs = {
      'data-cscope': scope,
      class: ($el.attr('class') || '').trim(),
      style: 'contain: content; isolation: isolate;', // layout containment
    };

    // Build final HTML (inline <style> scoped to the wrapper)
    const finalHtml = `
      <div ${Object.entries(wrapperAttrs)
        .map(([k, v]) => `${k}="${String(v)}"`)
        .join(' ')}>
        <style>${safeScopedCss}</style>
        ${safeHtml}
      </div>
    `;

    $el.replaceWith(finalHtml);
  }

  return $.html();
}
