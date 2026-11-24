import type { components } from './generated/schema';

export type ErrorResponse = components['schemas']['ErrorResponse'];

/** Client-side codes, in addition to the server's envelope codes (doc 12). */
export type ClientErrorCode = 'network_error' | 'timeout' | 'invalid_response';

/** Every failed API call surfaces as an ApiError, whatever went wrong. */
export class ApiError extends Error {
  override name = 'ApiError';

  constructor(
    readonly code: string,
    message: string,
    readonly status: number | null,
    readonly requestId: string | null = null,
    readonly details: unknown = null,
  ) {
    super(message);
  }

  /** 4xx errors won't succeed on retry; network/5xx might. */
  get isRetryable(): boolean {
    return this.status === null || this.status >= 500 || this.status === 429;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isErrorResponse(body: unknown): body is ErrorResponse {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return false;
  }
  const error = (body as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}
