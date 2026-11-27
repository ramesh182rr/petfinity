import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, LoadingState } from '@/components/states/StateViews';
import {
  Button,
  Card,
  HeroScreen,
  IconBadge,
  InitialsAvatar,
  SectionHeader,
  StatusPill,
  Text,
} from '@/components/ui';
import { formatRupees } from '@/features/catalog/format';
import { AvailabilityCard } from '@/features/discovery/AvailabilityCard';
import { BadgeCard, HeroStats, HoursCard, ServiceRow } from '@/features/discovery/DetailParts';
import { avatarName, distanceLabel } from '@/features/discovery/format';
import { useClinicListing } from '@/features/discovery/hooks';
import { useDiscoveryStore } from '@/features/discovery/store';
import { ratingTile, ReviewsSection } from '@/features/reviews/ReviewsSection';
import type { ClinicDetail } from '@/features/discovery/types';
import { transparentHeader } from '@/navigation/headerOptions';
import { spacing } from '@/theme';

/** Opens the address in the phone's maps app. No Maps API key or billing involved. */
function directionsUrl(clinic: ClinicDetail): string {
  const query =
    clinic.latitude != null && clinic.longitude != null
      ? `${clinic.latitude},${clinic.longitude}`
      : [clinic.name, clinic.address_line1, clinic.locality, clinic.city, clinic.postal_code]
          .filter(Boolean)
          .join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function ClinicListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const origin = useDiscoveryStore((s) => s.origin);
  const clinic = useClinicListing(id, origin);
  const [serviceId, setServiceId] = useState<string | null>(null);

  if (clinic.isPending) return <LoadingState message="Loading clinic…" />;
  if (clinic.isError) {
    const gone = isApiError(clinic.error) && clinic.error.status === 404;
    return gone ? (
      <EmptyState
        icon="eye-off-outline"
        tone="peach"
        title="This clinic isn't listed right now"
        message="It may be updating its details or paused bookings. Try another nearby clinic."
        action={{ label: 'Back to Discover', onPress: () => router.back() }}
      />
    ) : (
      <ErrorState
        onRetry={() => void clinic.refetch()}
        requestId={isApiError(clinic.error) ? clinic.error.requestId : null}
      />
    );
  }

  const c = clinic.data;
  const selected = c.services.find((s) => s.id === serviceId) ?? c.services[0];
  const from = Math.min(...c.services.map((s) => s.price_minor));
  const distance = distanceLabel(c.distance_km, c.distance_is_approximate);

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="clinic-listing"
        underHeader
        eyebrow={c.emergency_services ? 'Verified clinic · Emergency care' : 'Verified clinic'}
        title={c.name}
        subtitle={[[c.locality, c.city].filter(Boolean).join(', '), distance && `${distance} away`]
          .filter(Boolean)
          .join(' · ')}
        overlap
        heroContent={
          <HeroStats
            items={[
              { value: formatRupees(from), label: 'From' },
              ratingTile(c.rating, c.review_count ?? 0),
              { value: c.open_now ? 'Open' : 'Closed', label: 'Right now' },
            ]}
          />
        }
      >
        <BadgeCard checks={c.badge.checks} verifiedAt={c.badge.verified_at ?? null} />

        {c.description ? (
          <View style={styles.section}>
            <SectionHeader title="About" />
            <Card>
              <Text variant="body">{c.description}</Text>
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Services" />
          <Card style={styles.list}>
            {c.services.map((s) => (
              <ServiceRow
                key={s.id}
                service={s}
                selected={s.id === selected?.id}
                onPress={() => setServiceId(s.id)}
              />
            ))}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Available times" />
          <AvailabilityCard kind="clinic" id={c.id} service={selected} />
        </View>

        <ReviewsSection
          kind="clinic"
          id={c.id}
          name={c.name}
          rating={c.rating}
          count={c.review_count ?? 0}
          recent={c.recent_reviews ?? []}
        />

        {c.doctors.length ? (
          <View style={styles.section}>
            <SectionHeader title="Vets at this clinic" />
            <Card style={styles.list}>
              {c.doctors.map((d) => (
                <View key={d.id} style={styles.doctor}>
                  <InitialsAvatar name={avatarName(d.display_name)} size={44} onDark={false} />
                  <View style={styles.flexGap}>
                    <Text variant="bodyStrong">{d.display_name}</Text>
                    <Text variant="caption" color="textMuted" numberOfLines={1}>
                      {[d.qualifications, d.years_experience != null && `${d.years_experience} yrs`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <StatusPill label="Verified" tone="success" />
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Opening hours" />
          <HoursCard hours={c.hours} closures={c.closures} />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Address" />
          <Card style={styles.address}>
            <View style={styles.addressRow}>
              <IconBadge name="location" tone="coral" />
              <View style={styles.flexGap}>
                <Text variant="bodyStrong">{c.address_line1}</Text>
                <Text variant="caption" color="textMuted">
                  {[c.address_line2, c.locality, `${c.city} ${c.postal_code}`, c.state]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              </View>
            </View>
            <Button
              label="Get directions"
              icon="navigate"
              variant="secondary"
              fullWidth
              onPress={() => void Linking.openURL(directionsUrl(c))}
              testID="directions"
            />
          </Card>
        </View>
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  list: { paddingVertical: spacing.sm, gap: spacing.xs },
  flexGap: { flex: 1, gap: spacing.xxs },
  doctor: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm },
  address: { gap: spacing.md },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
