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
      // 1. Generate highlighted HTML using Shiki
      const shikiString = await codeToHtml(rawCode, {
        lang,
        themes: { light: 'github-light', dark: 'github-dark' },
      });

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
        ...new Set([...shikiClassArray, 'tt-codeblock-pre', `language-${lang}`]),
      ].filter((c): c is string => Boolean(c)); // Filter keeps strict string type

      const preNode: Element = {
        type: 'element',
        tagName: 'pre',
        properties: {
          ...node.properties,
          className: combinedClasses,
          style: shikiStyle,
          'data-language': lang,
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
