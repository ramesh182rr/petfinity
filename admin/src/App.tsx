import { Navigate, Route, Routes } from 'react-router'

import { useSession } from './auth/context'
import { Layout } from './components/Layout'
import { NotAuthorizedPage } from './pages/NotAuthorizedPage'
import { QueuePage } from './pages/QueuePage'
import { ReviewsPage } from './pages/ReviewsPage'
import { SignInPage } from './pages/SignInPage'
import { SubmissionPage } from './pages/SubmissionPage'

export function App() {
  const { status, isAdmin, isModerator } = useSession()
  if (status === 'loading') {
    return (
      <div className="center-page" aria-label="Loading">
        <div className="skeleton" style={{ width: 240, height: 24 }} />
      </div>
    )
  }
  if (status === 'signedOut') return <SignInPage />
  // The UI gate is a convenience; every /admin API call is enforced server-side.
  if (!isAdmin && !isModerator) return <NotAuthorizedPage />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={isAdmin ? '/verification' : '/reviews'} replace />} />
        {isAdmin ? (
          <>
            <Route path="/verification" element={<QueuePage />} />
            <Route path="/verification/:id" element={<SubmissionPage />} />
          </>
        ) : null}
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="*" element={<p>Page not found.</p>} />
      </Route>
    </Routes>
  )
}
