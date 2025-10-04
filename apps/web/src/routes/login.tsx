import * as React from "react"
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { authClient } from "@/lib/auth-client"

// shadcn/ui
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const Route = createFileRoute("/login")({
  component: LoginPage,
  ssr: false,
})

const HOME_PATH = "/"
const ORG_ONBOARDING_PATH = "/orgs" // <- adjust to your flow

function LoginPage() {
  const navigate = useNavigate()
  const { data: session, isPending: sessionLoading } = authClient.useSession()

  // Already logged in? Bounce home.
  if (!sessionLoading && session) {
    return <Navigate to={HOME_PATH} />
  }

  return (
    <div className="min-h-[100svh] bg-background text-foreground grid place-items-center p-4">
      <Card className="w-full max-w-[480px] border-border">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to continue, or create a new account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="sign-in" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sign-in">Sign in</TabsTrigger>
              <TabsTrigger value="sign-up">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="sign-in" className="pt-6">
              <SignInForm onSignedIn={() => navigate({ to: HOME_PATH })} />
            </TabsContent>

            <TabsContent value="sign-up" className="pt-6">
              <SignUpForm
                onSignedUp={() => navigate({ to: ORG_ONBOARDING_PATH })}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await authClient.signIn.email({
      email,
      password,
      rememberMe: remember,
    })
    setSubmitting(false)
    if (error) {
      setError(error.message ?? "Unable to sign in")
    } else {
      onSignedIn()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="inline-flex items-center gap-2 select-none">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Keep me signed in
        </label>
        {/* wire up later */}
        <a
          href="/forgot-password"
          className="text-primary underline underline-offset-4"
        >
          Forgot password
        </a>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}

function SignUpForm({ onSignedUp }: { onSignedUp: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const { error } = await authClient.signUp.email({ email, password, name })
    setSubmitting(false)
    if (error) {
      setError(error.message ?? "Unable to create account")
    } else {
      onSignedUp()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Full name</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="email2">Email</Label>
        <Input
          id="email2"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="password2">Password</Label>
        <Input
          id="password2"
          type="password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>
    </form>
  )
}
