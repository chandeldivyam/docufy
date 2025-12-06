// packages/mdx-kit/src/mdx-components/steps.ts
import type { Element, ElementContent } from 'hast';

export type StepTitleSize = 'p' | 'h2' | 'h3';

export function normalizeTitleSize(value: unknown): StepTitleSize {
  if (value === 'h2' || value === 'h3') return value;
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    if (v === 'h2' || v === 'h3') return v as StepTitleSize;
  }
  return 'p';
}

export function parseStepNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

export type BuiltStep = {
  root: Element;
  iconNode?: Element;
  iconName?: string;
};

export function buildStepElement(
  props: Record<string, unknown>,
  children: ElementContent[],
  index: number,
  defaultTitleSize: StepTitleSize,
): BuiltStep {
  const title = typeof props.title === 'string' ? props.title : undefined;
  const rawStepNumber = (props as { stepNumber?: unknown }).stepNumber;
  const rawTitleSize = (props as { titleSize?: unknown }).titleSize;
  const rawIcon = (props as { icon?: unknown }).icon;

  const stepNumber = parseStepNumber(rawStepNumber, index);
  const titleSize = normalizeTitleSize(rawTitleSize ?? defaultTitleSize);

  const iconName = typeof rawIcon === 'string' && rawIcon.trim() ? rawIcon.trim() : undefined;

  const indicatorChildren: ElementContent[] = [];
  let iconNode: Element | undefined;

  if (iconName) {
    iconNode = {
      type: 'element',
      tagName: 'span',
      properties: {
        className: ['dfy-step-icon'],
        'aria-hidden': 'true',
        'data-icon': iconName,
      },
      children: [],
    };
    indicatorChildren.push(iconNode);
  } else {
    indicatorChildren.push({
      type: 'element',
      tagName: 'span',
      properties: { className: ['dfy-step-number'] },
      children: [{ type: 'text', value: String(stepNumber) }],
    });
  }

  const indicatorNode: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['dfy-step-indicator'] },
    children: indicatorChildren,
  };

  const markerNode: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['dfy-step-marker'] },
    children: [
      indicatorNode,
      {
        type: 'element',
        tagName: 'div',
        properties: { className: ['dfy-step-line'] },
        children: [],
      },
    ],
  };

  const bodyChildren: ElementContent[] = [];

  if (title) {
    const titleTagName = titleSize === 'h2' || titleSize === 'h3' ? titleSize : 'p';
    bodyChildren.push({
      type: 'element',
      tagName: titleTagName,
      properties: {
        className: ['dfy-step-title', `dfy-step-title--${titleSize}`],
      },
      children: [{ type: 'text', value: title }],
    });
  }

  bodyChildren.push({
    type: 'element',
    tagName: 'div',
    properties: { className: ['dfy-step-content'] },
    children,
  });

  const bodyNode: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['dfy-step-body'] },
    children: bodyChildren,
  };

  const root: Element = {
    type: 'element',
    tagName: 'li',
    properties: { className: ['dfy-step', 'step'] },
    children: [markerNode, bodyNode],
  };

  return { root, iconNode, iconName };
}
