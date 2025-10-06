import Typesense from "typesense"

export function getTypesenseNodes() {
  try {
    const fromJson =
      process.env.DOCS_TS_NODES && JSON.parse(process.env.DOCS_TS_NODES!)
    if (Array.isArray(fromJson) && fromJson.length) return fromJson
  } catch {
    console.log("Failed to parse DOCS_TS_NODES")
  }
  return [
    {
      host: process.env.DOCS_TS_HOST ?? "localhost",
      port: Number(process.env.DOCS_TS_PORT ?? 8108),
      protocol: process.env.DOCS_TS_PROTOCOL ?? "http",
    },
  ]
}

export function makeTypesenseAdminClient() {
  const apiKey = process.env.DOCS_TS_ADMIN_KEY!

  return new Typesense.Client({
    nodes: getTypesenseNodes(),

    apiKey,
    connectionTimeoutSeconds: 5,
  })
}
