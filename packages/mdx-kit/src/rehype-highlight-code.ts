// packages/mdx-kit/src/rehype-highlight-code.ts
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { toText } from 'hast-util-to-text';
import { fromHtml } from 'hast-util-from-html';
import { codeToHtml } from 'shiki';
import type { Element, Root, ElementContent } from 'hast';

export const rehypeHighlightCode: Plugin<[], Root> = () => async (tree) => {
  const promises: (() => Promise<void>)[] = [];

  visit(tree, 'element', (node: Element, index, parent: Element | Root | null) => {
    // We are looking for 'pre' tags
    if (node.tagName !== 'pre' || !node.children) return;

    // Ensure strict structure: pre > code
    const codeNode = node.children.find(
      (c): c is Element => c.type === 'element' && c.tagName === 'code',
    );
    if (!codeNode) return;

    // Extract language
    const classNames = (codeNode.properties?.className as string[]) || [];
    const langPrefix = 'language-';
    const langClass = classNames.find((c) => c.startsWith(langPrefix));
    const lang = langClass ? langClass.slice(langPrefix.length) : 'text';

    // Extract raw code text
    const rawCode = toText(codeNode, { whitespace: 'pre' }).replace(/\n$/, '');

    // Queue the async work
    promises.push(async () => {
      let highlightLang = lang || 'text';
      let shikiString: string | null = null;

      try {
        // 1. Generate highlighted HTML using Shiki
        shikiString = await codeToHtml(rawCode, {
          lang: highlightLang,
          themes: { light: 'light-plus', dark: 'slack-dark' },
        });
      } catch {
        // Shiki can throw for unsupported languages; fall back to plain text rendering
        highlightLang = 'text';

        try {
          shikiString = await codeToHtml(rawCode, {
            lang: highlightLang,
            themes: { light: 'light-plus', dark: 'slack-dark' },
          });
        } catch {
          shikiString = null;
        }
      }

      if (!shikiString) {
        const fallbackCodeNode: Element = {
          type: 'element',
          tagName: 'code',
          properties: {
            ...codeNode.properties,
            className: [`language-${highlightLang}`],
          },
          children: [{ type: 'text', value: rawCode }],
        };

        const preNode: Element = {
          type: 'element',
          tagName: 'pre',
          properties: {
            ...node.properties,
            className: ['tt-codeblock-pre', `language-${highlightLang}`],
            'data-language': highlightLang,
          },
          children: [fallbackCodeNode],
        };

        const wrapperNode: Element = {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['tt-codeblock-group'],
          },
          children: [preNode],
        };

        if (parent && index !== undefined && index !== null) {
          parent.children[index] = wrapperNode;
        }

        return;
      }

      // 2. Parse the Shiki HTML string back into a HAST tree
      const shikiFragment = fromHtml(shikiString, { fragment: true });
      const shikiPre = shikiFragment.children.find(
        (c): c is Element => c.type === 'element' && c.tagName === 'pre',
      );

      if (!shikiPre) return;

      // 3. Extract attributes from Shiki result
      const shikiStyle = shikiPre.properties?.style || '';

      // FIX START: Normalize the class name to ensure it's strictly string[]
      const rawShikiClass = shikiPre.properties?.className;
      const shikiClassArray: string[] = Array.isArray(rawShikiClass)
        ? (rawShikiClass as string[])
        : typeof rawShikiClass === 'string'
          ? [rawShikiClass]
          : [];
      // FIX END

      // 4. Transform the original node
      const combinedClasses = [
        ...new Set([...shikiClassArray, 'tt-codeblock-pre', `language-${highlightLang}`]),
      ].filter((c): c is string => Boolean(c)); // Filter keeps strict string type

      const preNode: Element = {
        type: 'element',
        tagName: 'pre',
        properties: {
          ...node.properties,
          className: combinedClasses,
          style: shikiStyle,
          'data-language': highlightLang,
        },
        children: shikiPre.children as ElementContent[],
      };

      const wrapperNode: Element = {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['tt-codeblock-group'],
        },
        children: [preNode],
      };

      // Replace the original node in the tree
      if (parent && index !== undefined && index !== null) {
        parent.children[index] = wrapperNode;
      }
    });
  });

  await Promise.all(promises.map((fn) => fn()));
};
