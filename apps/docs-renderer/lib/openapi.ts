// apps/docs-renderer/lib/openapi.ts
import { createOpenAPI } from 'fumadocs-openapi/server';

export const openapi = createOpenAPI({
  proxyUrl: '/api/proxy',
});
