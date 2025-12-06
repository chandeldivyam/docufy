// packages/mdx-kit/src/mdx-components/transform-mdx-components.ts
import { visit } from 'unist-util-visit';
import type { Root, Element, ElementContent, Properties } from 'hast';
import type { MdxComponentConfig, MdxComponentRenderArgs } from '../types.js';
import { mdxAttributesToProps, type MdxJsxNode } from './mdx-attributes.js';
import { scheduleIconFetch } from './icon-utils.js';
import { buildTabsElement, type TabItem } from './tabs.js';
import { buildCalloutElement } from './callout.js';
import { buildCardElement } from './card.js';
import { buildColumnsElement } from './columns.js';
import { buildStepElement, normalizeTitleSize } from './steps.js';

type ComponentsMap = Record<string, MdxComponentConfig>;

export async function transformMdxComponents(
  tree: Root,
  components: ComponentsMap = {},
): Promise<void> {
  const tasks: Promise<void>[] = [];
  let tabsIdCounter = 0;

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

    // --- Tabs container ----------------------------------------------------
    if (name === 'Tabs') {
      const tabItems: TabItem[] = [];
      const nonTabChildren: string[] = [];

      for (const child of node.children ?? []) {
        if (
          child &&
          (child.type === 'mdxJsxFlowElement' || child.type === 'mdxJsxTextElement') &&
          child.name === 'Tab'
        ) {
          const tabProps = mdxAttributesToProps(child.attributes);
          const tabChildren = (child.children ?? []) as ElementContent[];
          const title =
            typeof (tabProps as { title?: unknown }).title === 'string'
              ? (tabProps as { title?: string }).title
              : undefined;

          tabItems.push({ title, children: tabChildren });
        } else if (child && child.type) {
          if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
            const childLabel =
              (child as { name?: string; type?: string }).name ??
              (child as { type?: string }).type ??
              'unknown';
            nonTabChildren.push(childLabel);
          }
        }
      }

      const idBase =
        typeof (props as { id?: unknown }).id === 'string'
          ? ((props as { id?: string }).id as string)
          : `dfy-tabs-${tabsIdCounter++}`;

      const tabsRoot = buildTabsElement(props, tabItems, idBase);

      parent.children[index] = tabsRoot;

      return;
    }

    // --- Single <Tab> outside a <Tabs> container ---------------------------
    if (name === 'Tab') {
      const parentName = (parent as { name?: string }).name;
      if (parentName === 'Tabs') return;

      const title =
        typeof (props as { title?: unknown }).title === 'string'
          ? (props as { title?: string }).title
          : undefined;

      const idBase = `dfy-tabs-${tabsIdCounter++}`;
      const tabsRoot = buildTabsElement({}, [{ title, children }], idBase);

      parent.children[index] = tabsRoot;
      return;
    }

    // --- Steps container ----------------------------------------------------
    if (name === 'Steps') {
      const defaultTitleSize = normalizeTitleSize((props as { titleSize?: unknown }).titleSize);

      const stepItems: Element[] = [];
      let ordinal = 0;
      const nonStepChildren: string[] = [];

      for (const child of node.children ?? []) {
        if (
          !child ||
          (child.type !== 'mdxJsxFlowElement' && child.type !== 'mdxJsxTextElement') ||
          child.name !== 'Step'
        ) {
          if (
            typeof process !== 'undefined' &&
            process.env?.NODE_ENV !== 'production' &&
            child?.type
          ) {
            const childLabel =
              (child as { name?: string; type?: string }).name ??
              (child as { type?: string }).type ??
              'unknown';
            nonStepChildren.push(childLabel);
          }
          continue;
        }

        const stepProps = mdxAttributesToProps(child.attributes);
        const stepChildren = (child.children ?? []) as ElementContent[];
        ordinal += 1;

        const built = buildStepElement(stepProps, stepChildren, ordinal, defaultTitleSize);
        stepItems.push(built.root);

        if (built.iconNode && built.iconName) {
          scheduleIconFetch(tasks, built.iconNode, built.iconName);
        }
      }

      const stepsRoot: Element = {
        type: 'element',
        tagName: 'ol',
        properties: {
          className: ['dfy-steps', 'steps'],
        },
        children: stepItems,
      };

      parent.children[index] = stepsRoot;
      return;
    }

    // --- Single Step outside a Steps container -----------------------------
    if (name === 'Step') {
      const defaultTitleSize = normalizeTitleSize((props as { titleSize?: unknown }).titleSize);

      const built = buildStepElement(props, children, 1, defaultTitleSize);

      const stepsRoot: Element = {
        type: 'element',
        tagName: 'ol',
        properties: {
          className: ['dfy-steps', 'steps'],
        },
        children: [built.root],
      };

      parent.children[index] = stepsRoot;

      if (built.iconNode && built.iconName) {
        scheduleIconFetch(tasks, built.iconNode, built.iconName);
      }

      return;
    }

    // 1) Built-in <Callout>
    if (name === 'Callout') {
      const { root, iconNode } = buildCalloutElement(props, children);
      parent.children[index] = root;

      const iconName =
        typeof (props as { icon?: unknown }).icon === 'string'
          ? (props as { icon?: string }).icon
          : undefined;

      if (iconName) {
        // Async: fetch SVG and attach it under iconNode
        scheduleIconFetch(tasks, iconNode, iconName);
      }

      return;
    }

    // 1b) Built-in <Card>
    if (name === 'Card') {
      const { root, iconNode } = buildCardElement(props, children);
      parent.children[index] = root;

      const iconName =
        typeof (props as { icon?: unknown }).icon === 'string'
          ? (props as { icon?: string }).icon
          : undefined;

      if (iconName && iconNode) {
        scheduleIconFetch(tasks, iconNode, iconName);
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
}
