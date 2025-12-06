// packages/mdx-kit/src/mdx-components/card.ts
import type { Element, ElementContent, Properties } from 'hast';

export type BuiltCard = {
  root: Element;
  iconNode?: Element;
};

export function buildCardElement(
  props: Record<string, unknown>,
  children: ElementContent[],
): BuiltCard {
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

// Tiny helper for boolean-ish props like horizontal, arrow, etc.
function isTruthyProp(value: unknown): boolean {
  if (value === true) return true;
  if (value === '') return true;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}
