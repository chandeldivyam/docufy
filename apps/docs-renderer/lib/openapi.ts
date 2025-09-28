// apps/docs-renderer/lib/openapi.ts
import { createOpenAPI } from 'fumadocs-openapi/server';

export const openapi = createOpenAPI({
  // Your remote spec; you can switch this to env later if you prefer
  input: ['https://zeus-api.atlas.so/openapi.json'],
});
