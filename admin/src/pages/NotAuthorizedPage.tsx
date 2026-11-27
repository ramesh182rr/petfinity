import { useSession } from '../auth/context'

export function NotAuthorizedPage() {
  const { user, signOut } = useSession()
  return (
    <div className="center-page">
      <div className="card auth-card stack">
        <h1>Not authorised</h1>
        <p className="muted">
          {user?.email ?? 'This account'} doesn&apos;t have admin or moderator access. Ask an
          existing admin to grant it to your verified company email.
        </p>
        <button className="btn btn-secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}
