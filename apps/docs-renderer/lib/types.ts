// apps/docs-renderer/lib/types.ts
export type NavSpace = {
  slug: string;
  name: string;
  style: 'dropdown' | 'tab';
  order: number;
  iconSvg?: string | null;
  entry?: string;
};

export type PageIndexEntry = {
  title: string;
  space: string;
  iconSvg?: string | null;
  blob: string; // relative blob key under Blob base URL
  hash: string;
  size: number;
  lastModified: number;
  kind: 'page' | 'api' | 'api_spec' | 'api_tag';
  api: {
    document?: string;
    path?: string;
    method?: string;
  } | null;
  previous?: { title: string; route: string } | null;
  next?: { title: string; route: string } | null;
};

export type Manifest = {
  version: 3;
  contentVersion: 'pm-bundle-v2';
  buildId: string;
  publishedAt: number;
  site: {
    projectId: string;
    layout: 'sidebar-dropdown' | 'tabs';
    baseUrl: string;
    name?: string | null;
    logoUrl?: string | null;
    branding?: {
      logo?: { light?: string | null; dark?: string | null };
      favicon?: { url: string } | null;
    };
  };
  routing: { basePath: string; defaultSpace: string };
  nav: { spaces: NavSpace[] };
  counts: { pages: number; newBlobs: number; reusedBlobs: number };
  pages: Record<string, PageIndexEntry>;
};

export type UiTreeItem = {
  kind: 'group' | 'page' | 'api_spec' | 'api' | 'api_tag';
  title: string;
  iconSvg?: string | null;
  slug: string;
  route: string;
  children?: UiTreeItem[];
  api?: {
    document?: string;
    path?: string;
    method?: string;
  } | null;
};

export type UiTreeSpace = {
  space: { slug: string; name: string; iconSvg?: string | null };
  items: UiTreeItem[];
};

export type Tree = {
  version: 2;
  projectId: string;
  buildId: string;
  publishedAt: number;
  nav: { spaces: Array<{ slug: string; name: string; order?: number; iconSvg?: string | null }> };
  spaces: UiTreeSpace[];
  buttons: {
    sidebar_top: Array<{
      id: string;
      label: string;
      href: string;
      iconSvg?: string | null;
      target?: '_self' | '_blank';
      slug?: string | null;
    }>;
    sidebar_bottom: Array<{
      id: string;
      label: string;
      href: string;
      iconSvg?: string | null;
      target?: '_self' | '_blank';
      slug?: string | null;
    }>;
    topbar_left: Array<{
      id: string;
      label: string;
      href: string;
      iconSvg?: string | null;
      target?: '_self' | '_blank';
      slug?: string | null;
    }>;
    topbar_right: Array<{
      id: string;
      label: string;
      href: string;
      iconSvg?: string | null;
      target?: '_self' | '_blank';
      slug?: string | null;
    }>;
  };
};

export type PageBlob = {
  id: string;
  slug: string;
  title: string;
  path: string[];
  iconSvg?: string | null;
  rendered: { html: string; toc: unknown[] };
  plain: string;
  markdown?: string;
  source: unknown;
  type: 'page' | 'api' | 'api_spec' | 'api_tag';
  apiSpecBlobKey?: string;
  apiMethod?: string;
  apiPath?: string;
};

export type ThemeJson = {
  version: 1;
  light?: { tokens?: Record<string, string>; vars?: Record<string, string> };
  dark?: { tokens?: Record<string, string> };
};
