// apps/docs-renderer/middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const config = { matcher: ['/((?!_next/|api/health).*)'] };

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const cookie = req.cookies.get('__doc_build')?.value;
  if (!cookie) {
    try {
      const base = process.env.DOCS_BLOB_BASE_URL!;
      const proj = process.env.DOCS_PROJECT_ID!;
      const pointerUrl = `${base}/sites/${proj}/latest.json`;
      const pointer = await fetch(pointerUrl, { next: { revalidate: 5 } }).then((r) => r.json());
      const { buildId, manifestUrl } = pointer as { buildId: string; manifestUrl: string };

      res.cookies.set('__doc_build', buildId, { path: '/', maxAge: 300, httpOnly: false });
      res.headers.append('Link', `<${manifestUrl}>; rel=preload; as=fetch; crossorigin`);
    } catch {
      /* fail open */
    }
  }

  // allow downstream caching variance
  res.headers.set('Vary', ['Cookie', 'Accept'].join(', '));
  return res;
}
