import { Link } from "react-router"
import { Button } from "@workspace/ui/components/button"
import { signOut, useSession } from "@/lib/auth-client"

export default function AuthorizedPage() {
  const { data: session } = useSession()

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Authenticated Area</h1>
        <p className="text-sm text-muted-foreground">
          This is a dummy protected page. You only see it when logged in.
        </p>
      </div>

      <div className="rounded-md border p-4">
        <p className="text-sm">Signed in as:</p>
        <p className="font-medium">{session?.user?.email ?? "Unknown user"}</p>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => {
            void signOut()
          }}
        >
          Sign out
        </Button>

        <Link
          className="inline-flex items-center text-sm underline"
          to="/signin"
        >
          Go to sign in route
        </Link>
      </div>
    </div>
  )
}
