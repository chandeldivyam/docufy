import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from "@electric-sql/client"

/**
 * Prepares the Electric SQL proxy URL from a request URL
 * Copies over Electric-specific query params and adds auth if configured
 * @param requestUrl - The incoming request URL
 * @returns The prepared Electric SQL origin URL
 */
export function prepareElectricUrl(requestUrl: string): URL {
  const url = new URL(requestUrl)
  const isProduction = process.env.NODE_ENV === "production"

  // Determine Electric URL based on environment
  let electricUrl: string

  if (isProduction) {
    // In production, always use Electric Cloud
    electricUrl = "https://api.electric-sql.cloud"
  } else if (
    process.env.ELECTRIC_SOURCE_ID &&
    process.env.ELECTRIC_SOURCE_SECRET
  ) {
    // In development, if Electric Cloud credentials are provided, use them
    electricUrl = "https://api.electric-sql.cloud"
  } else {
    // In development without cloud credentials, use local Electric
    electricUrl = "http://localhost:3000"
  }

  const originUrl = new URL(`${electricUrl}/v1/shape`)

  // Copy Electric-specific query params
  url.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value)
    }
  })

  // Add Electric Cloud authentication if configured
  if (process.env.ELECTRIC_SOURCE_ID && process.env.ELECTRIC_SOURCE_SECRET) {
    originUrl.searchParams.set("source_id", process.env.ELECTRIC_SOURCE_ID)
    originUrl.searchParams.set(
      "source_secret",
      process.env.ELECTRIC_SOURCE_SECRET
    )

    // In production, these should always be set
    if (
      isProduction &&
      (!process.env.ELECTRIC_SOURCE_ID || !process.env.ELECTRIC_SOURCE_SECRET)
    ) {
      console.warn(
        "Electric Cloud credentials not configured in production environment"
      )
    }
  }

  return originUrl
}

/**
 * Proxies a request to Electric SQL and returns the response
 * @param originUrl - The prepared Electric SQL URL
 * @returns The proxied response
 */
export async function proxyElectricRequest(originUrl: URL): Promise<Response> {
  try {
    const response = await fetch(originUrl)

    // Check for errors
    if (!response.ok) {
      console.error(
        `Electric proxy error: ${response.status} ${response.statusText}`
      )
    }

    const headers = new Headers(response.headers)
    headers.delete("content-encoding")
    headers.delete("content-length")
    headers.set("vary", "cookie")

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  } catch (error) {
    console.error("Failed to proxy Electric request:", error)

    // Return a proper error response
    return new Response(
      JSON.stringify({
        error: "Failed to connect to Electric sync service",
        details:
          process.env.NODE_ENV === "development" ? String(error) : undefined,
      }),
      {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "content-type": "application/json" },
      }
    )
  }
}
