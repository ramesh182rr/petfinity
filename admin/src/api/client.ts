/**
 * Admin API client (decision 0009).
 * - Access token: in memory only.
 * - Refresh token: httpOnly cookie set by /auth/web/*, sent via credentials: 'include'.
 * - Every cookie-auth call sends X-Requested-With (CSRF guard enforced by the API).
 */

export const CSRF_HEADER = { 'X-Requested-With': 'petfinity-web' }

export class ApiError extends Error {
  readonly code: string
  readonly status: number | null
  readonly requestId: string | null
  readonly details: unknown
  constructor(
    code: string,
    message: string,
    status: number | null,
    requestId: string | null = null,
    details: unknown = null,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.requestId = requestId
    this.details = details
  }
}

type Options = { method?: string; body?: unknown; auth?: boolean }

export type ApiClient = {
  request<T>(path: string, options?: Options): Promise<T>
  setAccessToken(token: string | null): void
  /** Called on 401 with auth; should refresh (single-flight) and return success. */
  setRefreshHandler(handler: (() => Promise<boolean>) | null): void
}

export function createApiClient(baseUrl: string, fetchImpl?: typeof fetch): ApiClient {
  let accessToken: string | null = null
  let refreshHandler: (() => Promise<boolean>) | null = null
  const doFetch: typeof fetch = (...args) => (fetchImpl ?? globalThis.fetch)(...args)

  async function send<T>(path: string, options: Options): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json', ...CSRF_HEADER }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'
    if (options.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`
    let response: Response
    try {
      response = await doFetch(`${baseUrl}/api/v1${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        credentials: 'include',
      })
    } catch {
      throw new ApiError('network_error', "Couldn't reach the Petfinity API.", null)
    }
    if (response.status === 204) return undefined as T
    const body: unknown = await response.json().catch(() => undefined)
    if (!response.ok) {
      const error = (
        body as {
          error?: { code?: string; message?: string; request_id?: string; details?: unknown }
        }
      )?.error
      throw new ApiError(
        error?.code ?? 'http_error',
        error?.message ?? `Request failed (${response.status})`,
        response.status,
        error?.request_id ?? response.headers.get('X-Request-ID'),
        error?.details ?? null,
      )
    }
    return body as T
  }

  return {
    async request<T>(path: string, options: Options = {}): Promise<T> {
      try {
        return await send<T>(path, options)
      } catch (error) {
        if (
          options.auth !== false &&
          refreshHandler &&
          error instanceof ApiError &&
          error.status === 401
        ) {
          if (await refreshHandler()) return send<T>(path, options)
        }
        throw error
      }
    },
    setAccessToken(token) {
      accessToken = token
    },
    setRefreshHandler(handler) {
      refreshHandler = handler
    },
  }
}

export const api = createApiClient((import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, ''))

/** Relative (local dev storage) URLs work as-is through the proxy; absolute R2 URLs too. */
export function resolveUrl(url: string): string {
  const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')
  return url.startsWith('/') ? `${base}${url}` : url
}
