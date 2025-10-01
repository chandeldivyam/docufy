import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const config = { matcher: ['/((?!_next/|api/health).*)'] };

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host')?.split(':')[0]?.toLowerCase() ?? '';
  const cookieName = `__doc_build_${host || 'default'}`;

  // 1) Resolve pointer once (cached at edge via revalidate)
  const base = process.env.DOCS_BLOB_BASE_URL!;
  const devHost = process.env.DOCS_DEV_HOST;
  const effectiveHost = devHost || host;

  const t0 = Date.now();
  let pointer = null;
  let buildId = '';
  let manifestUrl = '';
  let treeUrl = '';
  try {
    const resp = await fetch(`${base}/domains/${effectiveHost}/latest.json`, {
      cache: 'default',
    });
    if (resp.ok) {
      pointer = await resp.json();
      ({ buildId, manifestUrl, treeUrl } = pointer);
    }
  } catch {
    // swallow to keep request flowing
  }
  const t1 = Date.now();

  // 2) Forward pointer to the route as a request header
  const requestHeaders = new Headers(req.headers);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  if (pointer) {
    requestHeaders.set('x-docufy-build-id', buildId);
    requestHeaders.set('x-docufy-manifest-url', manifestUrl);
    requestHeaders.set('x-docufy-tree-url', treeUrl);
  }

  // 3) Hint + cookie for the browser (helps client navigations)
  if (pointer) {
    res.cookies.set(cookieName, buildId, { path: '/', maxAge: 300, httpOnly: false });
    res.headers.append('Link', `<${manifestUrl}>; rel=preload; as=fetch; crossorigin`);
    res.headers.append('Link', `<${treeUrl}>; rel=preload; as=fetch; crossorigin`);
    res.headers.append('Server-Timing', `ptr;dur=${t1 - t0}`);
  }
  res.headers.set('Vary', ['Host', 'Cookie', 'Accept'].join(', '));

  // Optional: add a quick server-timing metric so you can see pointer cost
  res.headers.append('Server-Timing', `ptr;dur=${t1 - t0}`);

  return res;
}
