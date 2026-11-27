import { createContext, useContext } from 'react'

import type { Me } from '../api/types'

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn'

export type SessionValue = {
  status: SessionStatus
  user: Me | null
  isAdmin: boolean
  isModerator: boolean
  requestCode(email: string): Promise<{ destination_masked: string; resend_after_seconds: number }>
  verifyCode(email: string, code: string): Promise<void>
  signOut(): Promise<void>
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used inside SessionProvider')
  return value
}
