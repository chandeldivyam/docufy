// packages/mdx-kit/src/mdx-components/mdx-attributes.ts

// Loosely typed MDX JSX nodes/attributes because mdast-util-mdx types are a bit heavy.
export type MdxJsxAttribute = {
  type: 'mdxJsxAttribute';
  name: string;
  // MDX can store raw expressions here; we stay conservative and mostly use strings.
  value?: string | { type: string; value?: unknown } | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MdxJsxNode = any;

export function mdxAttributesToProps(attrs: MdxJsxAttribute[] | undefined): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  if (!attrs) return props;

  for (const attr of attrs) {
    if (attr.type !== 'mdxJsxAttribute') continue;
    const { name, value } = attr;

    if (value == null) {
      // <X foo>
      props[name] = true;
    } else if (typeof value === 'string') {
      // <X foo="bar">
      props[name] = value;
    } else if (typeof value === 'object' && 'value' in value && value.value != null) {
      // Best-effort for <X foo={...}> when MDX gave us a literal
      props[name] = value.value;
    }
  }

  return props;
}
