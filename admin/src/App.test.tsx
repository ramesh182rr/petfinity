import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { api } from './api/client'
import { App } from './App'
import { SessionProvider } from './auth/session'
import { ADMIN, createFakeApi, SUBMISSION } from './test/fakeApi'

let fake: ReturnType<typeof createFakeApi>

function renderApp(path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <SessionProvider>
          <App />
        </SessionProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  fake = createFakeApi()
  globalThis.fetch = fake.fetch as unknown as typeof fetch
  api.setAccessToken(null)
})

const queue = {
  items: [
    {
      id: 'sub-1',
      subject_type: 'provider_profile',
      subject_id: 'pp-1',
      subject_label: 'Dr. Priya Nair',
      subject_kind: 'veterinarian',
      city: 'Chennai',
      status: 'pending',
      submitted_at: '2026-11-25T09:00:00Z',
      reviewed_at: null,
      submitter: SUBMISSION.submitter,
    },
  ],
  next_before: null,
}

describe('admin app', () => {
  it('signs in with an email code and reviews a submission', async () => {
    const user = userEvent.setup()
    fake.on('POST', '/auth/web/refresh', () => [
      401,
      { error: { code: 'invalid_refresh_token', message: 'Please sign in.' } },
    ])
    fake.on('POST', '/auth/otp/request', () => [
      202,
      {
        destination_masked: 'a***@petfinity.in',
        expires_in_seconds: 600,
        resend_after_seconds: 60,
      },
    ])
    fake.on('POST', '/auth/web/otp/verify', () => [
      200,
      {
        access_token: 'tok',
        token_type: 'bearer',
        expires_in: 900,
        refresh_expires_at: '2026-12-25T00:00:00Z',
        user: ADMIN,
        is_new_user: false,
      },
    ])
    fake.on('GET', '/admin/verification/submissions?status=pending', () => [200, queue])
    fake.on('GET', '/admin/verification/submissions/sub-1', () => [200, SUBMISSION])
    let decision: unknown = null
    fake.on('POST', '/admin/verification/submissions/sub-1/decision', (body) => {
      decision = body
      return [
        200,
        {
          id: 'sub-1',
          status: 'needs_info',
          submitted_at: SUBMISSION.submitted_at,
          reviewed_at: '2026-11-25T10:00:00Z',
          decision_reason: 'Blurry',
        },
      ]
    })

    renderApp()

    await user.type(await screen.findByLabelText('Work email'), 'Asha@Petfinity.in')
    await user.click(screen.getByRole('button', { name: 'Send code' }))
    expect(await screen.findByText('a***@petfinity.in')).toBeInTheDocument()
    await user.type(screen.getByLabelText('6-digit code'), '123456')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    // Queue
    const row = await screen.findByText('Dr. Priya Nair')
    expect(screen.getByText('Veterinarian')).toBeInTheDocument()
    expect(fake.calls.find((c) => c.path === '/auth/web/otp/verify')?.body).toMatchObject({
      destination: 'asha@petfinity.in',
    })

    // Detail with documents
    await user.click(row)
    expect(await screen.findByText('TNSVC/1234')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Government ID' })).toHaveAttribute(
      'src',
      SUBMISSION.documents[0]!.url,
    )
    await user.click(screen.getByRole('button', { name: /Veterinary council registration/ }))
    expect(screen.getByTitle('Veterinary council registration')).toHaveAttribute(
      'src',
      SUBMISSION.documents[1]!.url,
    )

    // Needs info requires a message to the applicant
    const panel = screen.getByRole('form', { name: 'Decision' })
    await user.click(within(panel).getByLabelText(/Ask for more information/))
    await user.click(within(panel).getByRole('button', { name: 'Send back for more information' }))
    expect(await within(panel).findByRole('alert')).toHaveTextContent('applicant will see this')
    expect(decision).toBeNull()

    await user.type(
      within(panel).getByLabelText(/Message to applicant/),
      'The registration certificate is blurry.',
    )
    await user.click(within(panel).getByRole('button', { name: 'Send back for more information' }))
    await waitFor(() =>
      expect(decision).toEqual({
        decision: 'needs_info',
        reason: 'The registration certificate is blurry.',
      }),
    )
    expect(await screen.findByRole('heading', { name: 'Verification' })).toBeInTheDocument()
  })

  it('restores a session from the cookie and blocks non-admins', async () => {
    fake.on('POST', '/auth/web/refresh', () => [
      200,
      {
        access_token: 'tok',
        token_type: 'bearer',
        expires_in: 900,
        refresh_expires_at: '2026-12-25T00:00:00Z',
      },
    ])
    fake.on('GET', '/me', () => [
      200,
      { ...ADMIN, email: 'owner@example.com', capabilities: ['pet_parent'] },
    ])

    renderApp('/verification')

    expect(await screen.findByRole('heading', { name: 'Not authorised' })).toBeInTheDocument()
    expect(fake.calls.some((c) => c.path.startsWith('/admin'))).toBe(false)
  })

  it('shows an empty state when nothing is pending', async () => {
    fake.on('POST', '/auth/web/refresh', () => [
      200,
      {
        access_token: 'tok',
        token_type: 'bearer',
        expires_in: 900,
        refresh_expires_at: '2026-12-25T00:00:00Z',
      },
    ])
    fake.on('GET', '/me', () => [200, ADMIN])
    fake.on('GET', '/admin/verification/submissions?status=pending', () => [
      200,
      { items: [], next_before: null },
    ])

    renderApp('/verification')

    expect(await screen.findByText('All caught up')).toBeInTheDocument()
  })
})
