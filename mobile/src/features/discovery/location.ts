import * as Location from 'expo-location';

const TIMEOUT_MS = 15_000;

export type DeviceLocation = { latitude: number; longitude: number };
export type LocationResult =
  { ok: true; location: DeviceLocation } | { ok: false; reason: 'denied' | 'unavailable' };

/** One-off, foreground-only position. Never tracked in the background. */
export async function getDeviceLocation(): Promise<LocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      return { ok: false, reason: 'denied' };
    }
    // A fix from the last few minutes is good enough and instant.
    const recent = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    const position =
      recent ??
      (await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
      ]));
    if (!position) return { ok: false, reason: 'unavailable' };
    return {
      ok: true,
      location: { latitude: position.coords.latitude, longitude: position.coords.longitude },
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export const LOCATION_MESSAGES = {
  denied: 'Location permission is off. Allow it in Settings, or choose an area instead.',
  unavailable: "We couldn't get your location. Check that location is on and try again.",
} as const;
