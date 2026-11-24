import { env } from '@/config/env';

/**
 * Media URLs are absolute (R2 presigned) or API-relative (local dev storage,
 * decision 0008). Resolve relative ones against the API base URL.
 */
export function resolveMediaUrl(
  url: string | null | undefined,
  baseUrl = env.apiBaseUrl,
): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${baseUrl}${url}` : url;
}
