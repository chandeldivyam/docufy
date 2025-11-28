// packages/mdx-kit/src/sanitize.ts
import { defaultSchema, type Options } from 'rehype-sanitize';

export function createSanitizeSchema(): Options {
  return {
    ...defaultSchema,
    // FIX: Disable the 'user-content-' prefix for IDs
    clobberPrefix: '',
    tagNames: [
      ...(defaultSchema.tagNames ?? []),
      'details',
      'summary',
      'video',
      'source',
      'figure',
      'figcaption',
      'svg',
      'path',
      // FIX: Ensure img/div/span are explicitly allowed if not already
      'img',
      'div',
      'span',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
    ],
    attributes: {
      ...defaultSchema.attributes,
      '*': [
        ...(defaultSchema.attributes?.['*'] ?? []),
        'className',
        'class',
        'id',
        'data-*',
        'style',
      ],
      img: [
        ...(defaultSchema.attributes?.img ?? []),
        'src',
        'alt',
        'width',
        'height',
        'loading',
        'decoding',
        'srcset',
        'sizes',
      ],
      video: [
        ...(defaultSchema.attributes?.video ?? []),
        'src',
        'poster',
        'width',
        'height',
        'controls',
        'autoplay',
        'loop',
        'muted',
        'playsinline',
        'preload',
        'controlslist',
      ],
      source: [...(defaultSchema.attributes?.source ?? []), 'src', 'type'],
      svg: [
        ...(defaultSchema.attributes?.svg ?? []),
        'xmlns',
        'viewBox',
        'width',
        'height',
        'fill',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
      ],
      path: [...(defaultSchema.attributes?.path ?? []), 'd'],
    },
    protocols: {
      ...defaultSchema.protocols,
      href: ['http', 'https', 'mailto', '#'], // FIX: Add '#' to allow anchor links
      src: ['http', 'https', 'data'],
    },
  };
}
