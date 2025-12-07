// packages/mdx-kit/src/mdx-components/icon-utils.ts
import { fromHtml } from 'hast-util-from-html';
import type { Element } from 'hast';

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
  } catch {
    iconCache.set(iconName, null);
    return null;
  }
}

/**
 * Schedule an async Lucide SVG fetch and mutate the provided icon node
 * once the SVG is available.
 */
export function scheduleIconFetch(
  tasks: Promise<void>[],
  iconNode: Element,
  iconName: string,
): void {
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
