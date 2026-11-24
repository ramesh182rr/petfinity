import { ApiError, isErrorResponse } from './errors';

export type ApiClientOptions = {
  baseUrl: string;
  /** Path prefix for the versioned API. */
  apiPrefix?: string;
  timeoutMs?: number;
  /** Defaults to the global fetch, looked up per request (so it can be swapped in tests). */
  fetchImpl?: typeof fetch;
};

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Set false for public endpoints (sign-in, refresh): no token, no refresh-on-401. */
  auth?: boolean;
};

/**
 * Provided by the auth feature. Kept as an injected interface so the API layer
 * never imports feature code.
 */
export type AuthHandlers = {
  getAccessToken(): string | null;
  /** Refresh the session (single-flight). Resolves true if a new access token is available. */
  refresh(): Promise<boolean>;
};

/** Short, non-identifying ID so a request can be traced in backend logs. */
export function createRequestId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `m-${Date.now().toString(36)}-${random}`;
}

export type ApiClient = {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  setAuthHandlers(handlers: AuthHandlers | null): void;
};

export function createApiClient({
  baseUrl,
  apiPrefix = '/api/v1',
  timeoutMs = 15_000,
  fetchImpl,
}: ApiClientOptions): ApiClient {
  let authHandlers: AuthHandlers | null = null;

  async function send<T>(
    path: string,
    options: RequestOptions,
    accessToken: string | null,
  ): Promise<T> {
    const requestId = createRequestId();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onCallerAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onCallerAbort);

    let response: Response;
    try {
      response = await (fetchImpl ?? globalThis.fetch)(`${baseUrl}${apiPrefix}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          'X-Request-ID': requestId,
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...options.headers,
        },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw timedOut
        ? new ApiError('timeout', 'The server took too long to respond.', null, requestId)
        : new ApiError(
            'network_error',
            "Couldn't reach Petfinity. Check your connection.",
            null,
            requestId,
          );
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onCallerAbort);
    }

    const serverRequestId = response.headers.get('X-Request-ID') ?? requestId;
    if (response.status === 204) {
      return undefined as T;
    }
    const body: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      if (isErrorResponse(body)) {
        const { code, message, details, request_id } = body.error;
        throw new ApiError(code, message, response.status, request_id ?? serverRequestId, details);
      }
      throw new ApiError(
        'invalid_response',
        'Unexpected response from the server.',
        response.status,
        serverRequestId,
      );
    }
    if (body === undefined) {
      throw new ApiError(
        'invalid_response',
        'Unexpected response from the server.',
        response.status,
        serverRequestId,
      );
    }
    return body as T;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const handlers = options.auth === false ? null : authHandlers;
    try {
      return await send<T>(path, options, handlers?.getAccessToken() ?? null);
    } catch (error) {
      // Expired access token: refresh once, then retry the original request once.
      if (handlers && error instanceof ApiError && error.status === 401) {
        if (await handlers.refresh()) {
          return send<T>(path, options, handlers.getAccessToken());
        }
      }
      throw error;
    }
  }

  return {
    request,
    setAuthHandlers(handlers) {
      authHandlers = handlers;
    },
  };
}
