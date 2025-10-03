import { headers } from 'next/headers';
import { domainPointerUrl } from './site';
import { fetchLatestBy } from './fetchers';
import type { Pointer } from './site';

export async function getPointer(): Promise<Pointer> {
  const h = await headers();
  const buildId = h.get('x-docufy-build-id');
  const manifestUrl = h.get('x-docufy-manifest-url');
  const treeUrl = h.get('x-docufy-tree-url');
  const themeUrl = h.get('x-docufy-theme-url') ?? undefined;

  if (buildId && manifestUrl && treeUrl) {
    return { buildId, manifestUrl, treeUrl, themeUrl };
  }

  // Fallback fetch
  return await fetchLatestBy(await domainPointerUrl());
}
