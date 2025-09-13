export type NavSpace = {
  slug: string;
  name: string;
  style: 'dropdown' | 'tab';
  order: number;
  iconName?: string;
  entry?: string;
};

export type PageIndexEntry = {
  title: string;
  space: string;
  iconName?: string;
  blob: string; // relative blob key under Blob base URL
  hash: string;
  size: number;
  neighbors: string[];
  lastModified: number;
};

export type Manifest = {
  version: 3;
  contentVersion: 'pm-bundle-v2';
  buildId: string;
  publishedAt: number;
  site: {
    projectId: string;
    layout: 'sidebar-dropdown' | 'sidebar-tabs';
    baseUrl: string;
    name?: string | null;
    logoUrl?: string | null;
  };
  routing: { basePath: string; defaultSpace: string };
  nav: { spaces: NavSpace[] };
  counts: { pages: number; newBlobs: number; reusedBlobs: number };
  pages: Record<string, PageIndexEntry>;
};

export type UiTreeItem = {
  kind: 'group' | 'page';
  title: string;
  iconName?: string;
  slug: string;
  route: string;
  children?: UiTreeItem[];
};

export type UiTreeSpace = {
  space: { slug: string; name: string; iconName?: string };
  items: UiTreeItem[];
};

export type Tree = {
  version: 2;
  projectId: string;
  buildId: string;
  publishedAt: number;
  nav: { spaces: Array<{ slug: string; name: string; order?: number; iconName?: string }> };
  spaces: UiTreeSpace[];
};

export type PageBlob = {
  id: string;
  slug: string;
  title: string;
  path: string[];
  iconName?: string;
  rendered: { html: string; toc: unknown[] };
  plain: string;
  source: unknown;
};
