import { useState, type FormEvent } from 'react'

import { ApiError } from '../api/client'
import { useSession } from '../auth/context'
import { Logo } from '../components/Logo'

export function SignInPage() {
  const { requestCode, verifyCode } = useSession()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [masked, setMasked] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const onEmail = (event: FormEvent) => {
    event.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    void run(async () => {
      const result = await requestCode(email.trim().toLowerCase())
      setMasked(result.destination_masked)
      setStep('code')
    })
  }

  const onCode = (event: FormEvent) => {
    event.preventDefault()
    void run(() => verifyCode(email.trim().toLowerCase(), code.trim()))
  }

  return (
    <div className="center-page">
      <div className="card auth-card stack">
        <div className="stack" style={{ gap: 6 }}>
          <Logo />
          <h1>Petfinity Admin</h1>
          <p className="muted">
            Staff only. Sign in with your work email; we&apos;ll send a 6-digit code.
          </p>
        </div>
        {step === 'email' ? (
          <form className="stack" onSubmit={onEmail} noValidate>
            <div className="field">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            {error ? (
              <p role="alert" className="alert error">
                {error}
              </p>
            ) : null}
            <button className="btn btn-primary" disabled={busy} type="submit">
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form className="stack" onSubmit={onCode} noValidate>
            <p>
              We sent a code to <strong>{masked}</strong>.
            </p>
            <div className="field">
              <label htmlFor="code">6-digit code</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>
            {error ? (
              <p role="alert" className="alert error">
                {error}
              </p>
            ) : null}
            <button className="btn btn-primary" disabled={busy || code.length !== 6} type="submit">
              {busy ? 'Checking…' : 'Sign in'}
            </button>
            <button
              className="btn btn-tertiary"
              type="button"
              onClick={() => {
                setStep('email')
                setCode('')
                setError(null)
              }}
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
