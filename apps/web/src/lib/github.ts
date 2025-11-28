import { App } from "octokit"

export class GithubRequestError extends Error {
  status?: number

  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message)
    this.name = "GithubRequestError"
    this.status = options?.status
    if (options?.cause) {
      this.cause = options.cause as Error
    }
  }
}

function toGithubRequestError(error: unknown, action: string) {
  const maybeObj = error as {
    status?: number
    response?: { status?: number; data?: { message?: string } }
    message?: string
  }
  const status = maybeObj?.status ?? maybeObj?.response?.status
  const detail =
    maybeObj?.response?.data?.message ??
    maybeObj?.message ??
    (typeof error === "string" ? error : "Unknown GitHub error")

  return new GithubRequestError(`${action}: ${detail}`, {
    status,
    cause: error,
  })
}

async function withGithubError<T>(action: string, fn: () => Promise<T>) {
  try {
    return await fn()
  } catch (error) {
    throw toGithubRequestError(error, action)
  }
}

export type InstallationRepository = {
  fullName: string
  defaultBranch: string
  private: boolean
}

function normalizePrivateKey(raw: string): string {
  // Accept literal "\n" sequences from .env by converting them to real newlines
  if (raw.includes("\\n")) return raw.replace(/\\n/g, "\n")
  return raw
}

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) {
    throw new Error(`Missing env: ${name}`)
  }
  return val
}

const app =
  process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY
    ? new App({
        appId: requireEnv("GITHUB_APP_ID"),
        privateKey: normalizePrivateKey(requireEnv("GITHUB_APP_PRIVATE_KEY")),
        oauth: {
          clientId: requireEnv("GITHUB_APP_CLIENT_ID"),
          clientSecret: requireEnv("GITHUB_APP_CLIENT_SECRET"),
        },
      })
    : null

export function getGithubApp(): App {
  if (!app) throw new GithubRequestError("GitHub App not configured")
  return app
}

export async function getInstallationClient(installationId: string) {
  const octokit = getGithubApp()
  return withGithubError("Failed to create installation client", () =>
    octokit.getInstallationOctokit(Number(installationId))
  )
}

export async function getInstallation(installationId: string) {
  const octokit = getGithubApp()
  return withGithubError("Failed to fetch installation", () =>
    octokit.octokit.request("GET /app/installations/{installation_id}", {
      installation_id: Number(installationId),
    })
  )
}

export async function listInstallationRepos(installationId: string) {
  const client = await getInstallationClient(installationId)
  const perPage = 100
  let page = 1
  const repos: InstallationRepository[] = []

  while (true) {
    const res = await withGithubError(
      "Failed to list installation repositories",
      () =>
        client.request("GET /installation/repositories", {
          per_page: perPage,
          page,
        })
    )

    repos.push(
      ...res.data.repositories.map((r) => ({
        fullName: r.full_name,
        defaultBranch: r.default_branch || "main",
        private: r.private,
      }))
    )

    if (res.data.repositories.length < perPage) break
    page += 1
  }

  return repos
}

export async function getFileContent(params: {
  installationId: string
  owner: string
  repo: string
  path: string
  ref: string
}) {
  const client = await getInstallationClient(params.installationId)
  const res = await withGithubError("Failed to fetch file content", () =>
    client.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: params.owner,
      repo: params.repo,
      path: params.path,
      ref: params.ref,
    })
  )

  if (!("content" in res.data)) {
    throw new Error("Requested path is not a file")
  }

  const buf = Buffer.from(res.data.content, res.data.encoding as BufferEncoding)
  return buf.toString("utf8")
}

export async function getFileBinary(params: {
  installationId: string
  owner: string
  repo: string
  path: string
  ref: string
}) {
  const client = await getInstallationClient(params.installationId)
  const res = await withGithubError("Failed to fetch file content", () =>
    client.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner: params.owner,
      repo: params.repo,
      path: params.path,
      ref: params.ref,
    })
  )

  if (!("content" in res.data)) {
    throw new Error("Requested path is not a file")
  }

  // Handle the "none" encoding case for large files (1-100 MB)
  if (res.data.encoding === "none" || !res.data.content) {
    // For large files, use the download_url instead
    if (!res.data.download_url) {
      throw new Error("File too large and no download URL available")
    }

    const downloadRes = await client.request("GET {url}", {
      url: res.data.download_url,
    })

    const buf = Buffer.from(downloadRes.data as string, "binary")
    return { content: buf, sha: res.data.sha as string | undefined }
  }

  // Normal case: base64 encoded content
  const encoding =
    typeof res.data.encoding === "string" &&
    Buffer.isEncoding(res.data.encoding)
      ? (res.data.encoding as BufferEncoding)
      : "base64"
  const buf = Buffer.from(res.data.content, encoding)
  return { content: buf, sha: res.data.sha as string | undefined }
}
