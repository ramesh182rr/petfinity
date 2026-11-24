import { describe, expect, it, vi } from 'vitest'

import { ApiError, createApiClient } from './client'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('admin api client', () => {
  it('sends cookies, the CSRF header and the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }))
    const client = createApiClient('', fetchMock)
    client.setAccessToken('tok')
    await client.request('/me')
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/me')
    expect(init.credentials).toBe('include')
    expect(init.headers['X-Requested-With']).toBe('petfinity-web')
    expect(init.headers.Authorization).toBe('Bearer tok')
  })

  it('refreshes once on 401 and retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'unauthorized', message: 'expired' } }))
      .mockResolvedValueOnce(json(200, { ok: true }))
    const client = createApiClient('', fetchMock)
    const refresh = vi.fn(async () => {
      client.setAccessToken('new')
      return true
    })
    client.setRefreshHandler(refresh)
    await expect(client.request('/me')).resolves.toEqual({ ok: true })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[1]![1].headers.Authorization).toBe('Bearer new')
  })

  it('surfaces the error envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(409, {
        error: { code: 'already_decided', message: 'Already decided.', request_id: 'r1' },
      }),
    )
    const error = await createApiClient('', fetchMock)
      .request('/x', { auth: false })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'already_decided', status: 409, requestId: 'r1' })
  })
})
