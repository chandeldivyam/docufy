// packages/mdx-kit/src/types.ts
import type { Element, ElementContent } from 'hast';

export type TocItem = {
  level: number;
  text: string;
  id: string;
};

export type MdxRenderOptions = {
  /**
   * Whether to enable GitHub Flavored Markdown extensions.
   * Defaults to true.
   */
  gfm?: boolean;
  /**
   * Whether to allow raw HTML in MDX (sanitized later).
   */
  allowHtml?: boolean;
  /**
   * Additional allowed MDX components (whitelist).
   * Key: component name ("Callout", "Tabs", etc).
   * Value: renderer behavior.
   */
  components?: Record<string, MdxComponentConfig>;
};

export type MdxComponentRenderArgs = {
  props: Record<string, unknown>;
  children: ElementContent[];
};

export type MdxComponentConfig =
  | {
      kind: 'inline';
      render: (args: MdxComponentRenderArgs) => Element | Element[];
    }
  | {
      kind: 'block';
      render: (args: MdxComponentRenderArgs) => Element | Element[];
    }
  | {
      kind: 'unsupported';
      fallback?: (source: string) => string;
    };
