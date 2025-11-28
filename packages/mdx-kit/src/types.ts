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
   * Key: component name ("Card", "Tabs", etc).
   * Value: renderer behavior.
   */
  components?: Record<string, MdxComponentConfig>;
};

export type MdxComponentConfig =
  | {
      kind: 'inline-drop';
      toHtml: (props: Record<string, unknown>, childrenHtml: string) => string;
    }
  | { kind: 'block-wrap'; toHtml: (props: Record<string, unknown>, childrenHtml: string) => string }
  | { kind: 'unsupported'; fallback?: (source: string) => string };
