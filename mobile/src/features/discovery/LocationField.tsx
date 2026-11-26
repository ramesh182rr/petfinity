import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ChipGroup, IconBadge, Text } from '@/components/ui';
import { spacing } from '@/theme';

import { useAreas } from './hooks';
import { getDeviceLocation, LOCATION_MESSAGES } from './location';
import type { Area, AreaKey } from './types';

export type LocationValue = {
  areaKey: AreaKey | null;
  latitude: string | null;
  longitude: string | null;
};

type Props = {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  /** Called with the chosen area so a form can prefill city/state. */
  onAreaPicked?: (area: Area) => void;
  /** Home-visit vets: how far they travel. */
  radius?: { value: number | null; onChange: (km: number) => void };
  pinHint: string;
  testID?: string;
};

/**
 * Launch area chips plus a one-tap "use my current location" pin (decision 0011).
 * No map or paid geocoding: the pin comes from the device's GPS.
 */
export function LocationField({ value, onChange, onAreaPicked, radius, pinHint, testID }: Props) {
  const areas = useAreas();
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const list = areas.data?.areas ?? [];
  const selected = list.find((a) => a.key === value.areaKey);
  const pinned = value.latitude !== null && value.longitude !== null;

  const pin = async () => {
    setLocating(true);
    setMessage(null);
    const result = await getDeviceLocation();
    setLocating(false);
    if (!result.ok) {
      setMessage(LOCATION_MESSAGES[result.reason]);
      return;
    }
    onChange({
      ...value,
      latitude: result.location.latitude.toFixed(6),
      longitude: result.location.longitude.toFixed(6),
    });
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <ChipGroup
        label="Area"
        options={list.map((a) => a.name)}
        selected={selected ? [selected.name] : []}
        onToggle={(name) => {
          const area = list.find((a) => a.name === name);
          if (!area) return;
          onChange({ ...value, areaKey: area.key });
          onAreaPicked?.(area);
        }}
        testID="location-areas"
      />
      {areas.isError ? (
        <Text variant="caption" color="error">
          {"Couldn't load areas. Try again later."}
        </Text>
      ) : null}

      <View style={styles.pinRow}>
        <IconBadge
          name={pinned ? 'location' : 'location-outline'}
          tone={pinned ? 'sage' : 'lavender'}
        />
        <View style={styles.pinText}>
          <Text variant="bodyStrong">{pinned ? 'Location pinned' : 'Not pinned yet'}</Text>
          <Text variant="caption" color="textMuted">
            {pinned ? 'Distances use this exact point.' : pinHint}
          </Text>
        </View>
        {pinned ? (
          <Button
            label="Clear"
            variant="tertiary"
            onPress={() => onChange({ ...value, latitude: null, longitude: null })}
            testID="location-clear"
          />
        ) : null}
      </View>
      <Button
        label={pinned ? 'Update to my current location' : 'Use my current location'}
        icon="navigate"
        variant="secondary"
        fullWidth
        loading={locating}
        onPress={() => void pin()}
        testID="location-pin"
      />
      {message ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {message}
        </Text>
      ) : null}

      {radius ? (
        <ChipGroup
          label="How far will you travel for home visits?"
          options={(areas.data?.service_radius_choices_km ?? [5, 10, 15, 25]).map(
            (km) => `${km} km`,
          )}
          selected={radius.value ? [`${radius.value} km`] : []}
          onToggle={(label) => radius.onChange(Number.parseInt(label, 10))}
          testID="location-radius"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  pinText: { flex: 1, gap: spacing.xxs },
});
