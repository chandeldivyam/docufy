export function getProjectId(): string {
  const id = process.env.DOCS_PROJECT_ID;
  if (!id) throw new Error('DOCS_PROJECT_ID missing');
  return id;
}

export function getBaseUrl(): string {
  const url = process.env.DOCS_BLOB_BASE_URL;
  if (!url) throw new Error('DOCS_BLOB_BASE_URL missing');
  return url.replace(/\/$/, '');
}

export type Pointer = { buildId: string; treeUrl: string; manifestUrl: string };
