import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { ErrorState, LoadingState, Skeleton } from '@/components/states/StateViews';
import {
  Button,
  Card,
  HeroScreen,
  IconBadge,
  ListRow,
  SectionHeader,
  StatusPill,
  Text,
} from '@/components/ui';
import { CARE_LABEL, READINESS, SPECIES_LABEL } from '@/features/care/format';
import { useCare } from '@/features/care/hooks';
import { formatRupees } from '@/features/catalog/format';
import { useDeleteException, useExceptions } from '@/features/catalog/hooks';
import { HeroStats } from '@/features/discovery/DetailParts';
import { useProviderProfile } from '@/features/providers/hooks';
import { STATUS_INFO } from '@/features/providers/labels';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, radius, spacing } from '@/theme';

/** Caretaker workspace (3.1): what you offer, where, your home, days off, readiness. */
export default function CareWorkspaceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProviderProfile(id, true);
  const care = useCare(id);
  const daysOff = useExceptions('provider_profile', id);
  const removeDay = useDeleteException('provider_profile', id);
  useRefreshOnFocus(profile.refetch, care.refetch, daysOff.refetch);

  if (profile.isPending || care.isPending) return <LoadingState message="Loading workspace…" />;
  if (profile.isError || care.isError) {
    const error = profile.error ?? care.error;
    return (
      <ErrorState
        onRetry={() => {
          void profile.refetch();
          void care.refetch();
        }}
        requestId={isApiError(error) ? error.requestId : null}
      />
    );
  }

  const p = profile.data;
  const c = care.data;
  const status = STATUS_INFO[p.verification_status];
  const active = c.services.filter((s) => s.active);
  const go = (path: string) => router.push(path as Href);
  const fix = (item: keyof typeof READINESS) =>
    item === 'services'
      ? go(`/provider/care/${id}/services`)
      : item === 'verification'
        ? go(`/provider/verify/provider_profile/${id}`)
        : go(`/provider/profile/${id}`);

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="care-workspace"
        underHeader
        eyebrow="Caretaker workspace"
        title={p.display_name}
        subtitle={
          c.receiving_requests
            ? 'You’re live: care requests near you will reach you.'
            : 'A few steps left before care requests reach you.'
        }
        overlap
        refreshControl={
          <RefreshControl
            refreshing={profile.isRefetching || care.isRefetching}
            onRefresh={() => {
              void profile.refetch();
              void care.refetch();
              void daysOff.refetch();
            }}
            tintColor={colors.primary}
          />
        }
        heroContent={
          <HeroStats
            items={[
              { value: String(active.length), label: active.length === 1 ? 'Service' : 'Services' },
              {
                value: p.max_concurrent ? String(p.max_concurrent) : '–',
                label: 'At once',
              },
              { value: status.short, label: 'Verification' },
            ]}
          />
        }
      >
        {c.missing.length ? (
          <Card style={styles.card} testID="care-readiness">
            <View style={styles.row}>
              <IconBadge name="rocket" tone="peach" />
              <View style={styles.flex}>
                <Text variant="bodyStrong">Get ready for requests</Text>
                <Text variant="caption" color="textMuted">
                  {c.missing.length} {c.missing.length === 1 ? 'step' : 'steps'} left
                </Text>
              </View>
            </View>
            {c.missing.map((item) => (
              <ListRow
                key={item}
                icon={READINESS[item].icon}
                tone="lavender"
                title={READINESS[item].title}
                subtitle={READINESS[item].hint}
                onPress={() => fix(item)}
                testID={`ready-${item}`}
              />
            ))}
          </Card>
        ) : (
          <Card style={styles.live} testID="care-live">
            <IconBadge name="checkmark-circle" tone="sage" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">You’re receiving requests</Text>
              <Text variant="caption" color="textMuted">
                Verified, with services, area and capacity set.
              </Text>
            </View>
            <StatusPill label="Live" tone="success" />
          </Card>
        )}

        <View style={styles.section}>
          <SectionHeader
            title="Your services"
            actionLabel={c.services.length ? 'Edit' : 'Add'}
            onAction={() => go(`/provider/care/${id}/services`)}
          />
          <Card style={styles.list}>
            {c.services.length ? (
              c.services.map((s) => {
                const t = CARE_LABEL[s.care_type];
                return (
                  <View
                    key={s.id}
                    style={[styles.service, !s.active && styles.paused]}
                    testID={`care-service-${s.care_type}`}
                  >
                    <IconBadge name={t.icon} tone={t.tone} />
                    <View style={styles.flex}>
                      <Text variant="bodyStrong">{t.label}</Text>
                      <Text variant="caption" color="textMuted" numberOfLines={1}>
                        {s.species.map((x) => SPECIES_LABEL[x] ?? x).join(', ')} · up to{' '}
                        {s.max_pets} {s.max_pets === 1 ? 'pet' : 'pets'}
                      </Text>
                      {!s.active ? <StatusPill label="Paused" tone="neutral" /> : null}
                    </View>
                    <View style={styles.price}>
                      <Text variant="subheading" color="primary">
                        {formatRupees(s.rate_minor)}
                      </Text>
                      <Text variant="caption" color="textMuted">
                        per {s.rate_unit}
                      </Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={styles.empty}>
                <Text variant="body" color="textMuted" align="center">
                  Home visits, day care, boarding or house sitting: choose what you offer.
                </Text>
                <Button
                  label="Choose services"
                  icon="add"
                  onPress={() => go(`/provider/care/${id}/services`)}
                />
              </View>
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Area, home and capacity"
            actionLabel="Edit"
            onAction={() => go(`/provider/profile/${id}`)}
          />
          <Card style={styles.list}>
            <ListRow
              icon="location"
              tone="coral"
              title={p.area_key ? `Travels up to ${p.service_radius_km ?? 10} km` : 'Area not set'}
              subtitle={
                p.latitude ? 'Pinned (private)' : 'Not pinned yet. Distance uses your area centre.'
              }
            />
            <ListRow
              icon="home"
              tone="peach"
              title={
                p.home_type === 'apartment'
                  ? 'Apartment'
                  : p.home_type === 'independent_house'
                    ? 'Independent house'
                    : 'Home not described'
              }
              subtitle={
                [
                  p.outdoor_space == null
                    ? null
                    : p.outdoor_space
                      ? 'Outdoor space'
                      : 'No outdoor space',
                  p.pets_at_home,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Needed for day care and boarding.'
              }
            />
            <ListRow
              icon="people"
              tone="lavender"
              title={
                p.max_concurrent
                  ? `${p.max_concurrent} ${p.max_concurrent === 1 ? 'booking' : 'bookings'} at once`
                  : 'Capacity not set'
              }
              subtitle="Overlapping care bookings never exceed this."
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Days off"
            actionLabel="Add"
            onAction={() => go(`/provider/manage/provider_profile/${id}/day-off?closedOnly=1`)}
          />
          <Card style={styles.list}>
            {daysOff.isPending ? (
              <Skeleton height={48} />
            ) : daysOff.data?.length ? (
              daysOff.data.map((d) => (
                <ListRow
                  key={d.id}
                  icon="moon"
                  tone="coral"
                  title={new Date(`${d.on_date}T00:00:00`).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  subtitle={d.note ?? 'Not taking care'}
                  trailing={
                    <Button
                      label="Remove"
                      variant="tertiary"
                      onPress={() =>
                        Alert.alert('Remove this day off?', undefined, [
                          { text: 'Keep', style: 'cancel' },
                          {
                            text: 'Remove',
                            style: 'destructive',
                            onPress: () => removeDay.mutate(d.id),
                          },
                        ])
                      }
                    />
                  }
                />
              ))
            ) : (
              <View style={styles.hint}>
                <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
                <Text variant="caption" color="textMuted" style={styles.flex}>
                  No days off planned. Requests that need you on a day off won’t reach you.
                </Text>
              </View>
            )}
          </Card>
        </View>
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xxs },
  card: { gap: spacing.sm },
  section: { gap: spacing.md },
  list: { paddingVertical: spacing.sm, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  live: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  paused: { opacity: 0.6 },
  price: { alignItems: 'flex-end' },
  empty: { gap: spacing.md, alignItems: 'center', paddingVertical: spacing.md },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
});
