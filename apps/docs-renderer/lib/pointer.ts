import { headers } from 'next/headers';
import { domainPointerUrl } from './site';
import { fetchLatestBy } from './fetchers';
import type { Pointer } from './site';

// Lightweight type guard instead of zod to keep perf tight
function isPointer(x: unknown): x is Pointer {
  if (!x || typeof x !== 'object') return false;

  const obj = x as Record<string, unknown>;
  return (
    typeof obj.buildId === 'string' &&
    typeof obj.manifestUrl === 'string' &&
    typeof obj.treeUrl === 'string'
  );
}

export async function getPointer(): Promise<Pointer> {
  // Prefer middleware-forwarded header to avoid another network hop
  const h = await headers();
  const raw = h.get('x-docufy-pointer');
  if (raw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (isPointer(parsed)) return parsed;
    } catch {
      /* fall through to network */
    }
  }
  // Fallback fetch
  return await fetchLatestBy(await domainPointerUrl());
}
