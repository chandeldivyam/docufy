// apps/docs-renderer/app/api/proxy/route.ts
import { openapi } from '../../../lib/openapi';

// Use node runtime to avoid edge limitations when proxying arbitrary hosts.
export const runtime = 'nodejs';

// Call createProxy and pass the override configuration
const proxyHandlers = openapi.createProxy({
  overrides: {
    response: (res) => {
      // The headers on the original Response object are immutable.
      // We create a new Headers object to make modifications.
      const headers = new Headers(res.headers);

      // The Node.js `fetch` automatically decompresses the response body (e.g., from brotli),
      // but it leaves the original header intact. Forwarding this header with the
      // now-decompressed body causes the `net::ERR_CONTENT_DECODING_FAILED` error in the browser.
      headers.delete('content-encoding');

      // Return a new Response object containing the original body and status,
      // but with our modified headers.
      return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers: headers,
      });
    },
  },
});

export const { GET, HEAD, PUT, POST, PATCH, DELETE } = proxyHandlers;
