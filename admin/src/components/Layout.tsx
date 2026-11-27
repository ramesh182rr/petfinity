import { NavLink, Outlet } from 'react-router'

import { useSession } from '../auth/context'
import { Logo } from './Logo'

export function Layout() {
  const { user, signOut, isAdmin } = useSession()
  return (
    <div className="shell">
      <header className="topbar">
        <div className="row">
          <Logo />
          <strong className="brand">Petfinity Admin</strong>
          <nav className="row nav" aria-label="Main">
            {isAdmin ? <NavLink to="/verification">Verification</NavLink> : null}
            <NavLink to="/reviews">Reviews</NavLink>
          </nav>
        </div>
        <div className="row">
          <span className="muted small">{user?.display_name ?? user?.email}</span>
          <button className="btn btn-tertiary" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
