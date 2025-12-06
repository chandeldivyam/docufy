// packages/mdx-kit/src/mdx-components/callout.ts
import type { Element, ElementContent, Properties } from 'hast';

export type BuiltCallout = {
  root: Element;
  iconNode: Element;
};

export function buildCalloutElement(
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
