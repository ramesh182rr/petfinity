import { ApiError, isErrorResponse } from './errors';

export type ApiClientOptions = {
  baseUrl: string;
  /** Path prefix for the versioned API. */
  apiPrefix?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

/** Short, non-identifying ID so a request can be traced in backend logs. */
export function createRequestId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `m-${Date.now().toString(36)}-${random}`;
}

export type ApiClient = {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
};

export function createApiClient({
  baseUrl,
  apiPrefix = '/api/v1',
  timeoutMs = 15_000,
  fetchImpl = fetch,
}: ApiClientOptions): ApiClient {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
      response = await fetchImpl(`${baseUrl}${apiPrefix}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          'X-Request-ID': requestId,
          ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
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
    if (body === undefined && response.status !== 204) {
      throw new ApiError(
        'invalid_response',
        'Unexpected response from the server.',
        response.status,
        serverRequestId,
      );
    }
    return body as T;
  }

  return { request };
}
