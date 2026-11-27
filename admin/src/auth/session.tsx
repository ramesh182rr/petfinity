import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { api, ApiError } from '../api/client'
import type { Me, WebSession, WebSignIn } from '../api/types'
import { SessionContext, type SessionStatus, type SessionValue } from './context'

// Single-flight: parallel refreshes would trip refresh-token reuse detection (decision 0007).
let refreshInFlight: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  refreshInFlight ??= api
    .request<WebSession>('/auth/web/refresh', { method: 'POST', auth: false })
    .then((session) => {
      api.setAccessToken(session.access_token)
      return true
    })
    .catch(() => {
      api.setAccessToken(null)
      return false
    })
    .finally(() => {
      refreshInFlight = null
    })
  return refreshInFlight
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [user, setUser] = useState<Me | null>(null)

  const clear = useCallback(() => {
    api.setAccessToken(null)
    setUser(null)
    setStatus('signedOut')
  }, [])

  useEffect(() => {
    api.setRefreshHandler(async () => {
      const ok = await refreshAccessToken()
      if (!ok) clear()
      return ok
    })
    let cancelled = false
    ;(async () => {
      if (!(await refreshAccessToken())) {
        if (!cancelled) clear()
        return
      }
      try {
        const me = await api.request<Me>('/me')
        if (!cancelled) {
          setUser(me)
          setStatus('signedIn')
        }
      } catch {
        if (!cancelled) clear()
      }
    })()
    return () => {
      cancelled = true
      api.setRefreshHandler(null)
    }
  }, [clear])

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      isAdmin: !!user?.capabilities.includes('admin'),
      isModerator: !!user?.capabilities.includes('moderator'),
      requestCode: (email) =>
        api.request('/auth/otp/request', {
          method: 'POST',
          body: { channel: 'email', destination: email },
          auth: false,
        }),
      async verifyCode(email, code) {
        const result = await api.request<WebSignIn>('/auth/web/otp/verify', {
          method: 'POST',
          body: { channel: 'email', destination: email, code },
          auth: false,
        })
        api.setAccessToken(result.access_token)
        setUser(result.user)
        setStatus('signedIn')
      },
      async signOut() {
        try {
          await api.request('/auth/web/logout', { method: 'POST' })
        } catch (error) {
          if (!(error instanceof ApiError)) throw error
        }
        clear()
      },
    }),
    [status, user, clear],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
