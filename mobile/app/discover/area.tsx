import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import { Card, Chip, ListRow, Screen, SectionHeader, Text } from '@/components/ui';
import { useAreas } from '@/features/discovery/hooks';
import { getDeviceLocation, LOCATION_MESSAGES } from '@/features/discovery/location';
import { useDiscoveryStore } from '@/features/discovery/store';
import type { Area } from '@/features/discovery/types';
import { colors, spacing } from '@/theme';

const RADII = [5, 10, 15, 25];

export default function AreaScreen() {
  const areas = useAreas();
  const origin = useDiscoveryStore((s) => s.origin);
  const radiusKm = useDiscoveryStore((s) => s.filters.radiusKm);
  const setOrigin = useDiscoveryStore((s) => s.setOrigin);
  const setFilters = useDiscoveryStore((s) => s.setFilters);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/discover'));

  const locateMe = async () => {
    setLocating(true);
    setMessage(null);
    const result = await getDeviceLocation();
    setLocating(false);
    if (!result.ok) {
      setMessage(LOCATION_MESSAGES[result.reason]);
      return;
    }
    setOrigin({ type: 'device', ...result.location });
    done();
  };

  if (areas.isPending) return <LoadingState message="Loading cities…" />;
  if (areas.isError) {
    return (
      <ErrorState
        onRetry={() => void areas.refetch()}
        requestId={isApiError(areas.error) ? areas.error.requestId : null}
      />
    );
  }

  const byState = areas.data.areas.reduce<Record<string, Area[]>>((acc, area) => {
    (acc[area.state] ??= []).push(area);
    return acc;
  }, {});

  return (
    <Screen edges={[]} testID="area-screen">
      <Card>
        <ListRow
          icon="navigate"
          tone="sage"
          title={locating ? 'Finding you…' : 'Use my current location'}
          subtitle="Used for this search only, never saved."
          onPress={() => void locateMe()}
          trailing={
            origin?.type === 'device' ? (
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
            ) : undefined
          }
          testID="area-near-me"
        />
        {message ? (
          <Text variant="caption" color="error" accessibilityRole="alert">
            {message}
          </Text>
        ) : null}
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Search radius" />
        <View style={styles.chips}>
          {RADII.map((km) => (
            <Chip
              key={km}
              label={`${km} km`}
              selected={radiusKm === km}
              onPress={() => setFilters({ radiusKm: km })}
              testID={`radius-${km}`}
            />
          ))}
        </View>
      </View>

      {Object.entries(byState).map(([state, list]) => (
        <View key={state} style={styles.section}>
          <SectionHeader title={state} />
          <Card style={styles.list}>
            {list.map((area) => {
              const selected = origin?.type === 'area' && origin.key === area.key;
              return (
                <ListRow
                  key={area.key}
                  icon={selected ? 'location' : 'location-outline'}
                  tone={selected ? 'lavender' : 'peach'}
                  title={area.name}
                  trailing={
                    selected ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : undefined
                  }
                  onPress={() => {
                    setOrigin({ type: 'area', key: area.key, name: area.name });
                    done();
                  }}
                  testID={`area-${area.key}`}
                />
              );
            })}
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm },
  list: { paddingVertical: spacing.sm, gap: spacing.xs },
});
