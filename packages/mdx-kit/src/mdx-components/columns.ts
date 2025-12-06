// packages/mdx-kit/src/mdx-components/columns.ts
import type { Element, ElementContent, Properties } from 'hast';

function normalizeCols(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  return 2; // Mintlify default
}

export function buildColumnsElement(
  props: Record<string, unknown>,
  children: ElementContent[],
): Element {
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
