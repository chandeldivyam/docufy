// packages/mdx-kit/src/remark-handle-mdx-components.ts
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import type { MdxRenderOptions } from './types.js';

// Helper to recursively extract text from MDAST nodes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNodeText(node: any): string {
  if (node.value) return node.value;
  if (node.children && Array.isArray(node.children)) {
    return node.children.map(getNodeText).join('');
  }
  return '';
}

export const remarkHandleMdxComponents: Plugin<[Pick<MdxRenderOptions, 'components'>?]> =
  (options) => (tree) => {
    const components = options?.components ?? {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visit(tree, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node: any) => {
      const name = node.name as string | undefined;
      if (!name) return;

      const config = components[name];

      // FIX: If no config found, check if it is a standard HTML tag.
      // If it starts with lowercase, treat as HTML and pass through.
      if (!config) {
        if (/^[a-z]/.test(name)) {
          // Reconstruct HTML tag
          const props: string[] = [];
          for (const attr of node.attributes ?? []) {
            if (attr.type === 'mdxJsxAttribute') {
              // Simple attribute serialization
              props.push(`${attr.name}="${String(attr.value ?? '')}"`);
            }
          }
          const propsStr = props.length > 0 ? ' ' + props.join(' ') : '';

          // Convert children to text/html if possible, or just ignore for void tags like img
          const isVoid = ['img', 'br', 'hr', 'input', 'meta'].includes(name);

          if (isVoid) {
            node.type = 'html';
            node.value = `<${name}${propsStr} />`;
          } else {
            // For block elements like div/span not in config, we try to preserve children
            // Note: This is tricky in Remark phase.
            // Best effort: wrap the children in raw HTML nodes
            const open = { type: 'html', value: `<${name}${propsStr}>` };
            const close = { type: 'html', value: `</${name}>` };
            node.children = [open, ...(node.children || []), close];
            // Unwrap the mdx node by replacing it with its children?
            // Actually simpler to just change this node to a fragment-like structure if supported,
            // but generic unist nodes are hard.
            // EASIER STRATEGY: Treat as unknown block, just render opening/closing HTML around children.
            // However, node structure implies we replace 'node' itself.
            // We can't easily replace one node with multiple in `visit` without index manipulation.
            // Fallback: Convert to a paragraph containing the HTML strings if block?
            // Let's stick to the user's pattern: convert node to HTML string.
            const childrenText = (node.children ?? []).map(getNodeText).join('');
            node.type = 'html';
            node.value = `<${name}${propsStr}>${childrenText}</${name}>`;
          }

          delete node.attributes;
          return;
        }

        // Fallback for unknown UPPERCASE components (likely missing config)
        node.type = 'inlineCode';
        node.value = `<${name}>`;
        delete node.children;
        delete node.attributes;
        return;
      }

      // --- Existing Component Logic ---

      const props: Record<string, unknown> = {};
      for (const attr of node.attributes ?? []) {
        if (attr.type === 'mdxJsxAttribute') {
          props[attr.name] = attr.value ?? true;
        }
      }

      // FIX: Use getNodeText to recursively get text from paragraphs/blocks
      const children = node.children ?? [];
      const childrenText = children.map(getNodeText).join('');

      if (config.kind === 'inline-drop' || config.kind === 'block-wrap') {
        const html = config.toHtml(props, childrenText);
        node.type = 'html';
        node.value = html;
        delete node.children;
        delete node.attributes;
      } else if (config.kind === 'unsupported') {
        const src = childrenText || `<${name} />`;
        const fallback = config.fallback?.(src) ?? '`' + src + '`';
        node.type = 'paragraph';
        node.children = [{ type: 'text', value: fallback }];
        delete node.attributes;
      }
    });
  };
