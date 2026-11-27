import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import * as api from './api';

/** Show pushes while the app is open too (as a banner, with sound). */
export function configureForegroundPushes(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PushState = 'granted' | 'undetermined' | 'denied';
export type PushSetup =
  | { ok: true; token: string }
  | { ok: false; reason: 'denied' | 'not_configured' | 'unsupported' | 'failed' };

let registeredToken: string | null = null;

export async function pushPermission(): Promise<PushState> {
  // Android 13+ reports "denied" before the app has ever asked; canAskAgain tells them apart.
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  return canAskAgain ? 'undetermined' : 'denied';
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Asks for permission when `ask` is true (only from a clear user action), then
 * registers this device's Expo push token with the API. In-app notifications work
 * either way; push needs an EAS project (and FCM on Android), decision 0013.
 */
export async function setUpPush({ ask }: { ask: boolean }): Promise<PushSetup> {
  if (!Device.isDevice && Platform.OS === 'ios') return { ok: false, reason: 'unsupported' };
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bookings', {
      name: 'Bookings and reminders',
      importance: AndroidImportance.HIGH,
      lightColor: '#6A2C7A',
    });
  }
  let state = await pushPermission();
  if (state !== 'granted' && ask) {
    const result = await Notifications.requestPermissionsAsync();
    state = result.status === 'granted' ? 'granted' : 'denied';
  }
  if (state !== 'granted') return { ok: false, reason: 'denied' };
  const id = projectId();
  if (!id) return { ok: false, reason: 'not_configured' };
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await api.registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
    registeredToken = token;
    return { ok: true, token };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** On sign-out: stop pushes to this phone for the account that's leaving. */
export async function releasePush(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await api.unregisterDevice(token).catch(() => undefined);
}

export const PUSH_MESSAGES = {
  denied: 'Notifications are off for Petfinity. Turn them on in your phone’s Settings.',
  not_configured:
    'Push isn’t set up on this build yet. You’ll still see everything here in the app.',
  unsupported: 'Push needs a real phone. You’ll still see everything here in the app.',
  failed: 'We couldn’t turn on push right now. Try again later.',
} as const;
