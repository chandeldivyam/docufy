import { fetchManifestV3 } from '../lib/fetchers';
import { currentBasePath } from '../lib/site';
import { getPointer } from '../lib/pointer';

export const runtime = 'edge';

export default async function sitemap() {
  const pointer = await getPointer();
  const manifest = await fetchManifestV3(pointer.manifestUrl);
  const prefix = (await currentBasePath()) || pointer.basePath || '';
  return Object.keys(manifest.pages).map((route) => ({
    url: `${prefix}${route}`,
    lastModified: new Date(manifest.pages[route]?.lastModified ?? 0),
  }));
}
