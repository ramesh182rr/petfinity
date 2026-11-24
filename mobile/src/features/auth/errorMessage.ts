import { isApiError } from '@/api';

/** Server messages are written for users; fall back to a friendly generic message. */
export function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.code === 'rate_limited') {
      const seconds = (error.details as { retry_after_seconds?: number } | null)
        ?.retry_after_seconds;
      if (seconds) {
        const minutes = Math.ceil(seconds / 60);
        return seconds < 90
          ? `Please wait ${seconds} seconds before requesting another code.`
          : `Too many code requests. Please try again in about ${minutes} minutes.`;
      }
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
