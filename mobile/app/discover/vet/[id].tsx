import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, LoadingState } from '@/components/states/StateViews';
import { Card, Chip, HeroScreen, ListRow, SectionHeader, Text } from '@/components/ui';
import { formatRupees } from '@/features/catalog/format';
import { AvailabilityCard } from '@/features/discovery/AvailabilityCard';
import { BadgeCard, HeroStats, HoursCard, ServiceRow } from '@/features/discovery/DetailParts';
import { useVetListing } from '@/features/discovery/hooks';
import { useDiscoveryStore } from '@/features/discovery/store';
import { ratingTile, ReviewsSection } from '@/features/reviews/ReviewsSection';
import { transparentHeader } from '@/navigation/headerOptions';
import { spacing } from '@/theme';

export default function VetListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const origin = useDiscoveryStore((s) => s.origin);
  const vet = useVetListing(id, origin);
  const [serviceId, setServiceId] = useState<string | null>(null);

  if (vet.isPending) return <LoadingState message="Loading vet…" />;
  if (vet.isError) {
    const gone = isApiError(vet.error) && vet.error.status === 404;
    return gone ? (
      <EmptyState
        icon="eye-off-outline"
        tone="peach"
        title="This vet isn't listed right now"
        message="They may be updating their details or paused home visits."
        action={{ label: 'Back to Discover', onPress: () => router.back() }}
      />
    ) : (
      <ErrorState
        onRetry={() => void vet.refetch()}
        requestId={isApiError(vet.error) ? vet.error.requestId : null}
      />
    );
  }

  const v = vet.data;
  const selected = v.services.find((s) => s.id === serviceId) ?? v.services[0];
  const from = Math.min(...v.services.map((s) => s.price_minor));

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="vet-listing"
        underHeader
        eyebrow="Verified vet · Home visits"
        title={v.display_name}
        subtitle={[v.qualifications, v.area_name].filter(Boolean).join(' · ')}
        overlap
        heroContent={
          <HeroStats
            items={[
              { value: formatRupees(from), label: 'From' },
              {
                value: v.years_experience != null ? `${v.years_experience} yrs` : '–',
                label: 'Experience',
              },
              ratingTile(v.rating, v.review_count ?? 0),
            ]}
          />
        }
      >
        {v.visits_you != null ? (
          <Card testID="visits-you">
            <ListRow
              icon={v.visits_you ? 'home' : 'alert-circle'}
              tone={v.visits_you ? 'sage' : 'coral'}
              title={v.visits_you ? 'Visits your area' : 'Outside their travel area'}
              subtitle={
                v.visits_you
                  ? `Home visits within ${v.service_radius_km} km of their base in ${v.area_name ?? 'your city'}.`
                  : 'Your location is beyond how far they travel. Try a vet closer to you.'
              }
            />
          </Card>
        ) : null}

        <BadgeCard checks={v.badge.checks} verifiedAt={v.badge.verified_at ?? null} />

        {v.bio || v.languages.length ? (
          <View style={styles.section}>
            <SectionHeader title="About" />
            <Card style={styles.about}>
              {v.bio ? <Text variant="body">{v.bio}</Text> : null}
              {v.languages.length ? (
                <View style={styles.chips}>
                  {v.languages.map((lang) => (
                    <Chip key={lang} label={lang} />
                  ))}
                </View>
              ) : null}
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Home-visit services" />
          <Card style={styles.list}>
            {v.services.map((s) => (
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
          <AvailabilityCard kind="vet" id={v.id} service={selected} />
        </View>

        <ReviewsSection
          kind="vet"
          id={v.id}
          name={v.display_name}
          rating={v.rating}
          count={v.review_count ?? 0}
          recent={v.recent_reviews ?? []}
        />

        {v.clinics.length ? (
          <View style={styles.section}>
            <SectionHeader title="Also practises at" />
            <Card style={styles.list}>
              {v.clinics.map((clinic) => (
                <ListRow
                  key={clinic.id}
                  icon="medkit"
                  tone="lavender"
                  title={clinic.name}
                  subtitle={[clinic.locality, clinic.city].filter(Boolean).join(', ')}
                  onPress={() =>
                    router.push({ pathname: '/discover/clinic/[id]', params: { id: clinic.id } })
                  }
                />
              ))}
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Visiting hours" />
          <HoursCard hours={v.hours} closures={v.closures} />
        </View>
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  list: { paddingVertical: spacing.sm, gap: spacing.xs },
  about: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
