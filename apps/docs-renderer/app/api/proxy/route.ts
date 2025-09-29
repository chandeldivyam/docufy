// apps/docs-renderer/app/api/proxy/route.ts
import { openapi } from '../../../lib/openapi';

// Use node runtime to avoid edge limitations when proxying arbitrary hosts.
export const runtime = 'nodejs';

export const { GET, HEAD, PUT, POST, PATCH, DELETE } = openapi.createProxy();
