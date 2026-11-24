import { QueryClient } from '@tanstack/react-query';

import { isApiError } from './errors';

const MAX_RETRIES = 2;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) {
    return false;
  }
  return isApiError(error) ? error.isRetryable : false;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
      },
      mutations: {
        // Mutations (bookings, payments) must never be retried blindly;
        // idempotency keys will make explicit retries safe.
        retry: false,
      },
    },
  });
}
