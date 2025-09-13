import type { Manifest, Tree, PageBlob } from './types';
import type { Pointer } from './site';
import { getBlobBaseUrl } from './site';
import { ManifestZ, TreeZ } from './schema';
const DEV = process.env.NODE_ENV !== 'production';

// Small, aggressively revalidated pointer fetch. Picks up publishes almost immediately.
export async function fetchLatestBy(pointerUrl: string): Promise<Pointer> {
  const res = await fetch(pointerUrl, { next: { revalidate: 2 } });
  if (!res.ok) throw new Error(`latest.json failed: ${res.status}`);
  return res.json();
}

export async function fetchManifestV3(manifestUrl: string): Promise<Manifest> {
  const res = await fetch(manifestUrl, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`manifest failed: ${res.status}`);
  const data = await res.json();
  if (DEV) ManifestZ.parse(data);
  return data;
}

export async function fetchTreeV2(treeUrl: string): Promise<Tree> {
  const res = await fetch(treeUrl, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`tree failed: ${res.status}`);
  const data = await res.json();
  if (DEV) TreeZ.parse(data);
  return data;
}

export async function fetchPageBlob(relBlobKey: string): Promise<PageBlob> {
  const res = await fetch(`${getBlobBaseUrl()}/${relBlobKey}`, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`blob failed: ${res.status}`);
  return res.json();
}

// Convenience aliases if preferred naming is desired
export const fetchPointer = fetchLatestBy;
export const fetchManifest = fetchManifestV3;
export const fetchTree = fetchTreeV2;
