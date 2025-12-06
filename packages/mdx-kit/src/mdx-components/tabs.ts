// packages/mdx-kit/src/mdx-components/tabs.ts
import type { Element, ElementContent, Properties } from 'hast';

export type TabItem = {
  title?: string;
  children: ElementContent[];
};

export function buildTabsElement(
  props: Record<string, unknown>,
  items: TabItem[],
  idBase: string,
): Element {
  const headerChildren: ElementContent[] = [];
  const panelChildren: ElementContent[] = [];

  items.forEach((item, index) => {
    const title = item.title || `Tab ${index + 1}`;
    const isActive = index === 0;
    const tabId = `${idBase}-tab-${index}`;
    const panelId = `${idBase}-panel-${index}`;

    const button: Element = {
      type: 'element',
      tagName: 'button',
      properties: {
        type: 'button',
        className: ['dfy-tab'],
        role: 'tab',
        id: tabId,
        'aria-controls': panelId,
        'aria-selected': isActive ? 'true' : 'false',
        tabIndex: isActive ? 0 : -1,
      },
      children: [{ type: 'text', value: title }],
    };

    headerChildren.push(button);

    const panelProps: Properties = {
      'data-type': 'tab',
      role: 'tabpanel',
      id: panelId,
      'aria-labelledby': tabId,
    };

    if (!isActive) {
      panelProps.hidden = true;
    }

    const panel: Element = {
      type: 'element',
      tagName: 'div',
      properties: panelProps,
      children: item.children,
    };

    panelChildren.push(panel);
  });

  const header: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['dfy-tabs-header'], role: 'tablist' },
    children: headerChildren,
  };

  const content: Element = {
    type: 'element',
    tagName: 'div',
    properties: { className: ['dfy-tabs-content'] },
    children: panelChildren,
  };

  const rootProps: Properties = {
    'data-type': 'tabs',
  };

  const userClass =
    (props as { className?: unknown }).className ?? (props as { class?: unknown }).class;

  if (Array.isArray(userClass)) {
    rootProps.className = userClass.map(String);
  } else if (typeof userClass === 'string') {
    rootProps.className = [userClass];
  }

  if (typeof (props as { id?: unknown }).id === 'string') {
    rootProps.id = (props as { id?: string }).id;
  }

  return {
    type: 'element',
    tagName: 'div',
    properties: rootProps,
    children: [header, content],
  };
}
