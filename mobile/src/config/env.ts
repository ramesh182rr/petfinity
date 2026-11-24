import { Platform } from 'react-native';

/**
 * Runtime configuration from EXPO_PUBLIC_* variables (inlined at bundle time).
 * Never put secrets here: these values ship inside the app.
 */

const DEV_FALLBACK = Platform.select({
  android: 'http://10.0.2.2:8000', // Android emulator → host machine
  default: 'http://localhost:8000',
});

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Validates and normalises the API base URL (no trailing slash, http/https only). */
export function resolveApiBaseUrl(raw: string | undefined, isDev: boolean): string {
  const value = raw?.trim();
  if (!value) {
    if (isDev) {
      return DEV_FALLBACK;
    }
    throw new ConfigError('EXPO_PUBLIC_API_URL must be set for non-development builds.');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigError(`EXPO_PUBLIC_API_URL is not a valid URL: ${value}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigError('EXPO_PUBLIC_API_URL must use http or https.');
  }
  if (!isDev && url.protocol !== 'https:') {
    throw new ConfigError('EXPO_PUBLIC_API_URL must use https outside development.');
  }
  return value.replace(/\/+$/, '');
}

export const env = {
  // Dot access is required for Expo to inline the value.
  apiBaseUrl: resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__),
} as const;
