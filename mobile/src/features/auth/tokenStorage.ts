import * as SecureStore from 'expo-secure-store';

/**
 * Only the refresh token is persisted, in the OS keychain/keystore (decision 0007).
 * The short-lived access token stays in memory. THIS_DEVICE_ONLY keeps tokens out
 * of iCloud Keychain sync and device migrations.
 */
const REFRESH_TOKEN_KEY = 'petfinity.refresh_token';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export async function loadRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, OPTIONS);
  } catch {
    // Unreadable (e.g. keystore reset after restore): treat as signed out.
    return null;
  }
}

export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, OPTIONS);
}

export async function clearRefreshToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, OPTIONS);
  } catch {
    // Nothing stored or keystore unavailable: already signed out.
  }
}
