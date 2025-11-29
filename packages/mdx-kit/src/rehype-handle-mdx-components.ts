// packages/mdx-kit/src/rehype-handle-mdx-components.ts
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { fromHtml } from 'hast-util-from-html';
import type { Root, Element, ElementContent, Properties } from 'hast';
import type { MdxRenderOptions, MdxComponentRenderArgs } from './types.js';

type Options = Pick<MdxRenderOptions, 'components'>;

// Loosely typed MDX JSX nodes/attributes because mdast-util-mdx types are a bit heavy.
type MdxJsxAttribute = {
  type: 'mdxJsxAttribute';
  name: string;
  // MDX can store raw expressions here; we stay conservative and mostly use strings.
  value?: string | { type: string; value?: unknown } | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MdxJsxNode = any;

// --- Helpers ---------------------------------------------------------------

function mdxAttributesToProps(attrs: MdxJsxAttribute[] | undefined): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (!attrs) return props;

  for (const attr of attrs) {
    if (attr.type !== 'mdxJsxAttribute') continue;
    const { name, value } = attr;

    if (value == null) {
      // <X foo>
      props[name] = true;
    } else if (typeof value === 'string') {
      // <X foo="bar">
      props[name] = value;
    } else if (typeof value === 'object' && 'value' in value && value.value != null) {
      // Best-effort for <X foo={...}> when MDX gave us a literal
      props[name] = value.value;
    }
  }

  return props;
}

// Simple in-memory icon cache to avoid re-fetching the same Lucide icon.
const iconCache = new Map<string, string | null>();

async function fetchIconSvg(iconName: string): Promise<string | null> {
  if (!iconName) return null;

  if (iconCache.has(iconName)) {
    return iconCache.get(iconName)!;
  }

  // If fetch isn't available (e.g. older Node), just skip icons.
  if (typeof fetch !== 'function') {
    iconCache.set(iconName, null);
    return null;
  }

  try {
    const res = await fetch(`https://unpkg.com/lucide-static@latest/icons/${iconName}.svg`);

    if (!res.ok) {
      iconCache.set(iconName, null);
      return null;
    }

    const svgText = await res.text();
    const cleaned = svgText
      .replace(/<!--.*?-->\s*/g, '')
      .replace(/ width="\d+"/, '')
      .replace(/ height="\d+"/, '');

    iconCache.set(iconName, cleaned);
    return cleaned;
  } catch (e) {
    console.error(`Failed to fetch icon: ${iconName}`, e);
    iconCache.set(iconName, null);
    return null;
  }
}

// Tiny helper for boolean-ish props like horizontal, arrow, etc.
function isTruthyProp(value: unknown): boolean {
  if (value === true) return true;
  if (value === '') return true;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

// --- Callout ---------------------------------------------------------------

type BuiltCallout = {
  root: Element;
  iconNode: Element;
};

function buildCalloutElement(
  props: Record<string, unknown>,
  children: ElementContent[],
): BuiltCallout {
  const title = typeof props.title === 'string' ? props.title : undefined;
  const color = typeof props.color === 'string' ? props.color : undefined;
  const icon = typeof props.icon === 'string' ? props.icon : undefined;
  const type = typeof props.type === 'string' ? props.type : 'note';

  const baseClasses: string[] = ['dfy-callout', `dfy-callout--${type}`];

  const userClass =
    (props.className as string | string[] | undefined) ??
    (props.class as string | string[] | undefined);

  if (Array.isArray(userClass)) {
    baseClasses.push(...userClass.map(String));
  } else if (typeof userClass === 'string') {
    baseClasses.push(userClass);
  }

  // Merge any existing style with the custom color variable.
  const stylePieces: string[] = [];
  if (typeof props.style === 'string') {
    stylePieces.push(props.style.replace(/;+\s*$/, ''));
  }
  if (color) {
    stylePieces.push(`--dfy-callout-color:${color}`);
  }

  const outerProps: Properties = {
    className: baseClasses,
  };

  if (stylePieces.length > 0) {
    outerProps.style = stylePieces.join('; ');
  }

  const iconNode: Element = {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['dfy-callout-icon'],
      'aria-hidden': 'true',
      ...(icon ? { 'data-icon': icon } : {}),
    },
    children: [],
  };

  const contentChildren: ElementContent[] = [];

  if (title) {
    contentChildren.push({
      type: 'element',
      tagName: 'div',
      properties: { className: ['dfy-callout-title'] },
      children: [{ type: 'text', value: title }],
    });
  }

  contentChildren.push({
    type: 'element',
    tagName: 'div',
    properties: { className: ['dfy-callout-content'] },
    children,
  });

  const bodyNode: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['dfy-callout-body'] },
    children: contentChildren,
  };

  const root: Element = {
    type: 'element',
    tagName: 'div',
    properties: outerProps,
    children: [iconNode, bodyNode],
  };

  return { root, iconNode };
}

// --- NEW: Card -------------------------------------------------------------

type BuiltCard = {
  root: Element;
  iconNode?: Element;
};

function buildCardElement(props: Record<string, unknown>, children: ElementContent[]): BuiltCard {
  const title = typeof props.title === 'string' ? props.title : undefined;
  const icon = typeof props.icon === 'string' ? props.icon : undefined;
  const href = typeof props.href === 'string' ? props.href : undefined;
  const horizontal = isTruthyProp(props.horizontal);

  const baseClasses: string[] = ['dfy-card'];
  if (horizontal) baseClasses.push('dfy-card--horizontal');
  if (href) baseClasses.push('dfy-card--link');

  const tagName = href ? 'a' : 'div';

  const outerProps: Properties = {
    className: baseClasses,
  };

  if (href) {
    outerProps.href = href;
  }

  let iconNode: Element | undefined;

  if (icon) {
    iconNode = {
      type: 'element',
      tagName: 'div',
      properties: {
        className: ['dfy-card-icon'],
        'aria-hidden': 'true',
        'data-icon': icon,
      },
      children: [],
    };
  }

  const headerChildren: ElementContent[] = [];
  if (iconNode) headerChildren.push(iconNode);

  if (title) {
    headerChildren.push({
      type: 'element',
      tagName: 'div',
      properties: { className: ['dfy-card-title'] },
      children: [{ type: 'text', value: title }],
    });
  }

  const headerNode: Element | null =
    headerChildren.length > 0
      ? {
          type: 'element',
          tagName: 'div',
          properties: { className: ['dfy-card-header'] },
          children: headerChildren,
        }
      : null;

  const bodyNode: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['dfy-card-body'] },
    children,
  };

  const root: Element = {
    type: 'element',
    tagName,
    properties: outerProps,
    children: headerNode ? [headerNode, bodyNode] : [bodyNode],
  };

  return { root, iconNode };
}

// --- NEW: Columns / CardGroup ---------------------------------------------

function normalizeCols(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 2; // Mintlify default :contentReference[oaicite:2]{index=2}
}

function buildColumnsElement(props: Record<string, unknown>, children: ElementContent[]): Element {
  const cols = Math.max(1, Math.min(4, normalizeCols(props.cols)));
  const stylePieces: string[] = [];
  stylePieces.push(`--dfy-columns-count:${cols}`);

  if (typeof props.gap === 'string') {
    stylePieces.push(`--dfy-columns-gap:${props.gap}`);
  }

  const outerProps: Properties = {
    className: ['dfy-columns'],
  };

  if (stylePieces.length > 0) {
    outerProps.style = stylePieces.join('; ');
  }

  return {
    type: 'element',
    tagName: 'div',
    properties: outerProps,
    children,
  };
}

// --- Plugin ----------------------------------------------------------------

export const rehypeHandleMdxComponents: Plugin<[Options?], Root> = (options) => async (tree) => {
  const components = options?.components ?? {};
  const tasks: Promise<void>[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visit(tree, (node: MdxJsxNode, index: number | undefined, parent: any) => {
    if (!parent || index === undefined) return;

    if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') {
      return;
    }

    const name: string | undefined = node.name;
    const props = mdxAttributesToProps(node.attributes);
    const children = (node.children ?? []) as ElementContent[];

    // Fragment-like <>...</>
    if (!name) {
      parent.children.splice(index, 1, ...children);
      return;
    }

    // 1) Built-in <Callout>
    if (name === 'Callout') {
      const { root, iconNode } = buildCalloutElement(props, children);
      parent.children[index] = root;

      const iconName = typeof props.icon === 'string' ? props.icon : undefined;
      if (iconName) {
        // Async: fetch SVG and attach it under iconNode
        tasks.push(
          (async () => {
            const svg = await fetchIconSvg(iconName);
            if (!svg) return;

            const fragment = fromHtml(svg, { fragment: true });
            const svgElement = fragment.children.find(
              (c): c is Element => c.type === 'element' && c.tagName === 'svg',
            );

            if (!svgElement) return;

            // Overwrite iconNode children with the parsed SVG
            iconNode.children = [svgElement];
          })(),
        );
      }

      return;
    }

    // 1b) Built-in <Card>
    if (name === 'Card') {
      const { root, iconNode } = buildCardElement(props, children);
      parent.children[index] = root;

      const iconName = typeof props.icon === 'string' ? props.icon : undefined;
      if (iconName && iconNode) {
        tasks.push(
          (async () => {
            const svg = await fetchIconSvg(iconName);
            if (!svg) return;

            const fragment = fromHtml(svg, { fragment: true });
            const svgElement = fragment.children.find(
              (c): c is Element => c.type === 'element' && c.tagName === 'svg',
            );

            if (!svgElement) return;

            iconNode.children = [svgElement];
          })(),
        );
      }

      return;
    }

    // 1c) Built-in <Columns> and <CardGroup> (alias)
    if (name === 'Columns' || name === 'CardGroup') {
      const root = buildColumnsElement(props, children);
      parent.children[index] = root;
      return;
    }

    // 2) User-supplied component configs
    const config = components[name];

    if (config && (config.kind === 'inline' || config.kind === 'block')) {
      const args: MdxComponentRenderArgs = { props, children };
      const result = config.render(args);
      const repl = Array.isArray(result) ? result : [result];
      parent.children.splice(index, 1, ...repl);
      return;
    }

    if (config && config.kind === 'unsupported') {
      const src = `<${name}>`;
      const fallback = config.fallback?.(src) ?? '`' + src + '`';
      parent.children[index] = {
        type: 'element',
        tagName: 'p',
        properties: {},
        children: [{ type: 'text', value: fallback }],
      };
      return;
    }

    // 3) Lowercase tags: treat as native HTML (<img>, <video>, etc.)
    if (/^[a-z]/.test(name)) {
      const element: Element = {
        type: 'element',
        tagName: name,
        properties: props as Properties,
        children,
      };
      parent.children[index] = element;
      return;
    }

    // 4) Unknown UPPERCASE components – render as inline code placeholder
    parent.children[index] = {
      type: 'element',
      tagName: 'code',
      properties: {},
      children: [{ type: 'text', value: `<${name}>` }],
    };
  });

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
};
