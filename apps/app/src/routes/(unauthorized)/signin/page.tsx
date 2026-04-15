import { useState, type SyntheticEvent } from "react"
import { Link } from "react-router"
import { Button } from "@workspace/ui/components/button"
import { signIn } from "@/lib/auth-client"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  async function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setMessage("")

    try {
      const result = await signIn.email({ email, password })

      if (result.error) {
        setMessage(result.error.message ?? "Could not sign in")
      }
    } catch {
      setMessage("Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Welcome back.</p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            className="rounded-md border bg-background px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            className="rounded-md border bg-background px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
        </label>

        <Button disabled={isLoading} type="submit">
          {isLoading ? "Please wait..." : "Sign in"}
        </Button>
      </form>

      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}

      <p className="text-sm">
        Need an account?{" "}
        <Link className="underline" to="/signup">
          Sign up
        </Link>
      </p>
    </div>
  )
}
