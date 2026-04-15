import { useState, type SyntheticEvent } from "react"
import { Link, useNavigate } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { useSignUp } from "@/hooks/use-auth"
import { queryKeys } from "@/lib/query-keys"

export default function SignUpPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const signUp = useSignUp()

  async function onSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()
    signUp.mutate(
      { email, password, name },
      {
        onSuccess: async () => {
          await queryClient.refetchQueries({ queryKey: queryKeys.auth.session })
          navigate("/", { replace: true })
        },
      },
    )
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="text-sm text-muted-foreground">Get started for free.</p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>

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

        <Button disabled={signUp.isPending} type="submit">
          {signUp.isPending ? "Please wait..." : "Create account"}
        </Button>
      </form>

      {signUp.error ? (
        <p className="text-sm text-destructive">{signUp.error.message}</p>
      ) : null}

      <p className="text-sm">
        Already have an account?{" "}
        <Link className="underline" to="/signin">
          Sign in
        </Link>
      </p>
    </div>
  )
}
