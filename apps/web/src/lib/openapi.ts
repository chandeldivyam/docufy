import * as YAML from "yaml"
import { dereference } from "@scalar/openapi-parser"

export const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
] as const

export type ParsedOpenApiOperation = {
  path: string
  method: string
  title: string
  description?: string
  tag?: string | null
  slugBase: string
  plain: string
}

export type ParsedOpenApiSpec = {
  tagOrder: string[]
  operations: ParsedOpenApiOperation[]
}

export function slugifyTitle(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 120)
}

export async function parseOpenApiSpec(
  specText: string
): Promise<ParsedOpenApiSpec> {
  const raw = specText.trim().startsWith("{")
    ? JSON.parse(specText)
    : YAML.parse(specText)

  const { schema } = await dereference(raw)
  if (!schema?.paths) {
    throw new Error("No paths in OpenAPI schema")
  }

  const tagOrder: string[] = Array.isArray(schema.tags)
    ? (schema.tags
        .map((t: unknown) =>
          t && typeof t === "object" && "name" in (t as Record<string, unknown>)
            ? String((t as { name?: unknown }).name)
            : null
        )
        .filter(Boolean) as string[])
    : []
  const tagIndex = new Map(tagOrder.map((t, i) => [t, i]))

  const operations: ParsedOpenApiOperation[] = []

  for (const [apiPath, pathItem] of Object.entries(schema.paths)) {
    for (const method of HTTP_METHODS) {
      const op = pathItem?.[method]
      if (!op) continue

      const summary =
        typeof op.summary === "string" && op.summary.trim()
          ? op.summary.trim()
          : null
      const operationId =
        typeof op.operationId === "string" && op.operationId.trim()
          ? op.operationId.trim()
          : null
      const title =
        summary ?? operationId ?? `${method.toUpperCase()} ${apiPath}`
      const tag =
        Array.isArray(op.tags) && op.tags[0] ? String(op.tags[0]) : null
      const description =
        typeof op.description === "string" ? op.description : undefined

      operations.push({
        path: apiPath,
        method: method.toUpperCase(),
        title,
        description,
        tag,
        slugBase: slugifyTitle(title),
        plain: [title, description].filter(Boolean).join(" "),
      })
    }
  }

  // Preserve declared tag order first, then alphabetical
  operations.sort((a, b) => {
    const aIdx =
      a.tag && tagIndex.has(a.tag)
        ? tagIndex.get(a.tag)!
        : Number.MAX_SAFE_INTEGER
    const bIdx =
      b.tag && tagIndex.has(b.tag)
        ? tagIndex.get(b.tag)!
        : Number.MAX_SAFE_INTEGER
    if (aIdx !== bIdx) return aIdx - bIdx
    if (a.tag !== b.tag) return (a.tag ?? "").localeCompare(b.tag ?? "")
    if (a.path !== b.path) return a.path.localeCompare(b.path)
    return a.method.localeCompare(b.method)
  })

  return { tagOrder, operations }
}
