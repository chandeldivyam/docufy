// apps/docs-renderer/lib/site.ts
import { headers } from 'next/headers';

export function getBlobBaseUrl(): string {
  const url = process.env.DOCS_BLOB_BASE_URL;
  if (!url) throw new Error('DOCS_BLOB_BASE_URL missing');
  return url.replace(/\/$/, '');
}

export async function currentHost(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const bare = host?.split(':')[0]?.toLowerCase() ?? '';
  const devHost = process.env.DOCS_DEV_HOST?.trim().toLowerCase();
  // When running prod locally (next start), map localhost -> your dev docs host
  if (devHost && (bare === 'localhost' || bare === '127.0.0.1' || bare.endsWith('.local'))) {
    return devHost;
  }
  return bare;
}

export async function domainPointerUrl(host?: string): Promise<string> {
  const resolvedHost = host ?? (await currentHost());
  return `${getBlobBaseUrl()}/domains/${encodeURIComponent(resolvedHost)}/latest.json`;
}

/** Optional subpath support via reverse proxy header. */
export async function currentBasePath(): Promise<string> {
  const h = await headers(); // ✅ await
  const raw = h.get('x-docufy-basepath') || '';
  if (!raw || !raw.startsWith('/')) return '';
  return raw.length > 1 ? raw.replace(/\/+$/, '') : '';
}

export type Pointer = {
  buildId: string;
  treeUrl: string;
  manifestUrl: string;
  basePath?: string;
};

export async function readPointerFromHeader<T = unknown>(): Promise<T | null> {
  const h = await headers();
  const raw = h.get('x-docufy-pointer');
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as T;
  } catch {
    return null;
  }
}
