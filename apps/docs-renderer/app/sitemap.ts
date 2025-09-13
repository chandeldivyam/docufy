import { fetchLatest, fetchManifestV3 } from '../lib/fetchers';

export const runtime = 'edge';

export default async function sitemap() {
  const pointer = await fetchLatest();
  const manifest = await fetchManifestV3(pointer.manifestUrl);
  return Object.keys(manifest.pages).map((route) => ({
    url: route,
    lastModified: new Date(manifest.pages[route]?.lastModified ?? 0),
  }));
}
