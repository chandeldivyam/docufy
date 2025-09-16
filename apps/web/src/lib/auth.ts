import { betterAuth } from "better-auth"
import { organization } from "better-auth/plugins"
import { reactStartCookies } from "better-auth/react-start"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/db/connection"
import * as schema from "@/db/auth-schema"
import { networkInterfaces } from "os"

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

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: process.env.NODE_ENV === "production",
    minPasswordLength: process.env.NODE_ENV === "production" ? 8 : 1,
  },
  trustedOrigins: [
    "https://webapp.localhost",
    `https://${networkIP}`,
    "http://localhost:5173",
  ],
  plugins: [organization(), reactStartCookies()],
})
