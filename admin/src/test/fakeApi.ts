import { vi } from 'vitest'

type Handler = (body: unknown, init: RequestInit) => [number, unknown]

export function createFakeApi() {
  const routes = new Map<string, Handler>()
  const calls: { method: string; path: string; body: unknown; init: RequestInit }[] = []
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    const u = new URL(url, 'http://admin.test')
    const path = u.pathname.replace('/api/v1', '') + u.search
    const body = init.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, path, body, init })
    const handler =
      routes.get(`${method} ${path}`) ??
      routes.get(`${method} ${u.pathname.replace('/api/v1', '')}`)
    if (!handler) {
      return new Response(JSON.stringify({ error: { code: 'not_found', message: 'Not Found' } }), {
        status: 404,
      })
    }
    const [status, payload] = handler(body, init)
    return new Response(status === 204 ? null : JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  return {
    on: (method: string, path: string, handler: Handler) =>
      routes.set(`${method} ${path}`, handler),
    calls,
    fetch: fetchMock,
  }
}

export const ADMIN = {
  id: 'u-admin',
  display_name: 'Asha (Admin)',
  email: 'asha@petfinity.in',
  email_verified: true,
  phone: null,
  phone_verified: false,
  capabilities: ['pet_parent', 'admin'],
  created_at: '2026-11-25T00:00:00Z',
}

export const SUBMISSION = {
  id: 'sub-1',
  subject_type: 'provider_profile',
  subject_id: 'pp-1',
  status: 'pending',
  applicant_note: 'Registered 2016',
  submitted_at: '2026-11-25T09:00:00Z',
  reviewed_at: null,
  decision_reason: null,
  reviewer: null,
  submitter: { id: 'u-1', display_name: 'Priya', email: 'dr.priya@example.com', phone: null },
  provider: {
    id: 'pp-1',
    provider_type: 'veterinarian',
    display_name: 'Dr. Priya Nair',
    bio: null,
    years_experience: 8,
    languages: ['Tamil', 'English'],
    city: 'Chennai',
    registration_number: 'TNSVC/1234',
    registration_council: 'Tamil Nadu State Veterinary Council',
    qualifications: 'B.V.Sc.',
    verification_status: 'submitted',
    verified_at: null,
    status: 'active',
    created_at: '2026-11-25T08:00:00Z',
    updated_at: '2026-11-25T08:00:00Z',
  },
  clinic: null,
  documents: [
    {
      id: 'd-1',
      doc_type: 'identity',
      content_type: 'image/jpeg',
      size_bytes: 120000,
      uploaded_at: '2026-11-25T08:30:00Z',
      url: '/api/v1/dev-storage/verification/x/a.jpg?sig=1',
      url_expires_in: 300,
    },
    {
      id: 'd-2',
      doc_type: 'vet_registration',
      content_type: 'application/pdf',
      size_bytes: 2400000,
      uploaded_at: '2026-11-25T08:31:00Z',
      url: '/api/v1/dev-storage/verification/x/b.pdf?sig=2',
      url_expires_in: 300,
    },
  ],
  history: [],
}
