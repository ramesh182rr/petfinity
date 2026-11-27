import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { api } from './api/client'
import { App } from './App'
import { SessionProvider } from './auth/session'
import { ADMIN, createFakeApi } from './test/fakeApi'

let fake: ReturnType<typeof createFakeApi>

const REFRESH = {
  access_token: 'tok',
  token_type: 'bearer',
  expires_in: 900,
  refresh_expires_at: '2026-12-25T00:00:00Z',
}

const REVIEW = {
  id: 'r-1',
  status: 'pending',
  rating: 1,
  text: 'Rude staff.',
  reply_text: null,
  flag_reason: 'reported',
  listing_name: 'Paws & Care Clinic',
  author_name: 'Arun K.',
  author_contact: 'arun@example.com',
  created_at: '2026-11-27T10:00:00Z',
  updated_at: '2026-11-27T11:00:00Z',
  reports: [{ reason: 'fake', note: 'Never visited', created_at: '2026-11-27T11:00:00Z' }],
  moderation_note: null,
}

function renderApp(path: string) {
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
  fake.on('POST', '/auth/web/refresh', () => [200, REFRESH])
})

describe('review moderation', () => {
  it('lets a moderator remove a reported review with a note', async () => {
    let pending = [REVIEW]
    fake.on('GET', '/me', () => [
      200,
      { ...ADMIN, email: 'mod@petfinity.in', capabilities: ['pet_parent', 'moderator'] },
    ])
    fake.on('GET', '/admin/reviews?status=pending', () => [200, { items: pending }])
    fake.on('POST', '/admin/reviews/r-1/decision', () => {
      pending = []
      return [200, { items: [] }]
    })

    renderApp('/')

    expect(await screen.findByText('Rude staff.')).toBeInTheDocument()
    expect(screen.getByText('Never visited')).toBeInTheDocument()
    expect(screen.getByText('Reported')).toBeInTheDocument()
    // Moderators see Reviews only, not Verification.
    expect(screen.queryByRole('link', { name: 'Verification' })).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/Note to the author/), 'Personal attack.')
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }))

    await waitFor(() =>
      expect(fake.calls.find((c) => c.path === '/admin/reviews/r-1/decision')?.body).toEqual({
        action: 'remove',
        note: 'Personal attack.',
      }),
    )
    expect(await screen.findByText('All caught up')).toBeInTheDocument()
  })

  it('shows admins both sections', async () => {
    fake.on('GET', '/me', () => [200, ADMIN])
    fake.on('GET', '/admin/reviews?status=pending', () => [200, { items: [] }])
    renderApp('/reviews')
    expect(await screen.findByText('All caught up')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Verification' })).toBeInTheDocument()
  })
})
