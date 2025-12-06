// packages/mdx-kit/src/rehype-handle-mdx-components.ts
import type { Plugin } from 'unified';
import type { Root } from 'hast';
import type { MdxRenderOptions } from './types.js';
import { transformMdxComponents } from './mdx-components/transform-mdx-components.js';

type Options = Pick<MdxRenderOptions, 'components'>;

export const rehypeHandleMdxComponents: Plugin<[Options?], Root> = (options) => {
  const components = options?.components ?? {};

  return async (tree: Root) => {
    await transformMdxComponents(tree, components);
  };
};
