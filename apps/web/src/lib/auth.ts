import { betterAuth } from "better-auth"
import { organization } from "better-auth/plugins"
import { reactStartCookies } from "better-auth/react-start"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/db/connection"
import * as schema from "@/db/auth-schema"
import { networkInterfaces } from "os"

// Get network IP for local development
const nets = networkInterfaces()
let networkIP = "192.168.1.1"
for (const name of Object.keys(nets)) {
  const netInterfaces = nets[name]
  if (netInterfaces) {
    for (const net of netInterfaces) {
      if (net.family === "IPv4" && !net.internal) {
        networkIP = net.address
        break
      }
    }
  }
}

// Determine if we're in production
const isProduction = process.env.NODE_ENV === "production"

// Build trusted origins list
const trustedOrigins: string[] = []

// Production origins
if (isProduction) {
  // Add your production domain
  if (process.env.PUBLIC_URL) {
    trustedOrigins.push(process.env.PUBLIC_URL)
  }
  // Add Vercel preview URLs
  if (process.env.VERCEL_URL) {
    trustedOrigins.push(`https://${process.env.VERCEL_URL}`)
  }
  // Add your custom domain
  trustedOrigins.push("https://app.trydocufy.com")
} else {
  // Development origins
  trustedOrigins.push(
    "https://web.localhost",
    `https://${networkIP}`,
    "http://localhost:5173",
    "http://localhost:3000"
  )
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    // Require stronger passwords in production
    minPasswordLength: isProduction ? 8 : 1,
  },
  trustedOrigins: trustedOrigins.filter(Boolean),
  plugins: [organization(), reactStartCookies()],
  // Add secure cookie settings for production
  ...(isProduction && {
    cookies: {
      secure: true,
      sameSite: "lax",
    },
  }),
})
