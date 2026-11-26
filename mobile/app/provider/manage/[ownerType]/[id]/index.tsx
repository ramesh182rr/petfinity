import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, LoadingState, Skeleton } from '@/components/states/StateViews';
import {
  Button,
  Card,
  Chip,
  HeroScreen,
  IconBadge,
  ListRow,
  SectionHeader,
  StatusPill,
  Text,
} from '@/components/ui';
import {
  CATEGORY_LABEL,
  WEEKDAYS_SHORT,
  categoryTone,
  formatDuration,
  formatRupees,
  formatTime,
  upcomingDays,
} from '@/features/catalog/format';
import {
  useDeleteException,
  useExceptions,
  useHours,
  useServices,
  useSlotPreview,
} from '@/features/catalog/hooks';
import { DayStrip, SlotGrid } from '@/features/catalog/SlotPicker';
import type { OwnerType, Service } from '@/features/catalog/types';
import { useClinic, useProviderProfile } from '@/features/providers/hooks';
import { STATUS_INFO } from '@/features/providers/labels';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, radius, spacing } from '@/theme';

function ServiceCard({ service, onPress }: { service: Service; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${service.title}, ${formatRupees(service.price_minor)}, ${formatDuration(service.duration_minutes)}`}
      style={({ pressed }) => [
        styles.serviceCard,
        !service.active && styles.inactive,
        pressed && styles.pressed,
      ]}
      testID={`service-${service.id}`}
    >
      <IconBadge name="medkit" tone={categoryTone(service.category)} />
      <View style={styles.serviceText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {service.title}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {CATEGORY_LABEL[service.category]} · {formatDuration(service.duration_minutes)} ·{' '}
          {service.service_mode === 'home_visit' ? 'Home visit' : 'Clinic visit'}
        </Text>
        <View style={styles.pills}>
          <StatusPill
            label={service.confirmation_mode === 'instant' ? 'Instant' : 'On request'}
            tone={service.confirmation_mode === 'instant' ? 'success' : 'warning'}
          />
          {!service.active ? <StatusPill label="Paused" tone="neutral" /> : null}
        </View>
      </View>
      <Text variant="subheading" color="primary">
        {formatRupees(service.price_minor)}
      </Text>
    </Pressable>
  );
}

export default function ManageScreen() {
  const params = useLocalSearchParams<{ ownerType: string; id: string }>();
  const ownerType: OwnerType = params.ownerType === 'clinic' ? 'clinic' : 'provider_profile';
  const id = params.id;
  const isClinic = ownerType === 'clinic';
  const clinic = useClinic(id, isClinic);
  const profile = useProviderProfile(id, !isClinic);
  const services = useServices(ownerType, id);
  const hours = useHours(ownerType, id);
  const exceptions = useExceptions(ownerType, id);
  const removeException = useDeleteException(ownerType, id);
  useRefreshOnFocus(services.refetch, hours.refetch, exceptions.refetch);

  const days = upcomingDays(14);
  const [previewDate, setPreviewDate] = useState(days[0]?.iso ?? '');
  const [previewService, setPreviewService] = useState<string | null>(null);
  const activeServices = services.data?.filter((s) => s.active) ?? [];
  const selectedService = previewService ?? activeServices[0]?.id ?? null;
  const slots = useSlotPreview(ownerType, id, selectedService, previewDate);

  const subject = isClinic ? clinic : profile;
  if (subject.isPending) return <LoadingState message="Loading workspace…" />;
  if (subject.isError || !subject.data) {
    return (
      <ErrorState
        onRetry={() => void subject.refetch()}
        requestId={isApiError(subject.error) ? subject.error.requestId : null}
      />
    );
  }
  const name = isClinic ? clinic.data?.name : profile.data?.display_name;
  const status = STATUS_INFO[subject.data.verification_status];
  const base = `/provider/manage/${ownerType}/${id}`;
  const openDays = new Set(hours.data?.rules.map((r) => r.weekday) ?? []).size;

  const go = (path: string) => router.push(path as Href);

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="manage-screen"
        underHeader
        eyebrow={isClinic ? 'Clinic workspace' : 'Your vet workspace'}
        title={name ?? ''}
        subtitle="Services, opening hours and the slots pet parents can book."
        overlap
        heroContent={
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text variant="heading" color="textOnPrimary">
                {services.data?.length ?? '–'}
              </Text>
              <Text variant="caption" style={styles.heroStatLabel}>
                Services
              </Text>
            </View>
            <View style={styles.heroStat}>
              <Text variant="heading" color="textOnPrimary">
                {hours.data ? openDays : '–'}
              </Text>
              <Text variant="caption" style={styles.heroStatLabel}>
                Open days
              </Text>
            </View>
            <View style={styles.heroStat}>
              <Text variant="label" color="textOnPrimary" numberOfLines={1}>
                {status.short}
              </Text>
              <Text variant="caption" style={styles.heroStatLabel}>
                Verification
              </Text>
            </View>
          </View>
        }
      >
        <Card style={styles.card}>
          <ListRow
            icon="shield-checkmark"
            tone={subject.data.verification_status === 'verified' ? 'sage' : 'peach'}
            title="Verification"
            subtitle={
              subject.data.verification_status === 'verified'
                ? 'Verified by Petfinity'
                : 'Needed before pet parents can find you'
            }
            trailing={<StatusPill label={status.label} tone={status.tone} />}
            onPress={() => go(`/provider/verify/${ownerType}/${id}`)}
            testID="manage-verification"
          />
        </Card>

        <View style={styles.section}>
          <SectionHeader
            title="Services"
            actionLabel="Add"
            onAction={() => go(`${base}/service`)}
          />
          {services.isPending ? (
            <Card style={styles.card}>
              <Skeleton height={64} />
              <Skeleton height={64} />
            </Card>
          ) : services.data?.length ? (
            <Card style={styles.list}>
              {services.data.map((s) => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  onPress={() => go(`${base}/service?serviceId=${s.id}`)}
                />
              ))}
            </Card>
          ) : (
            <Card>
              <EmptyState
                compact
                icon="pricetags-outline"
                tone="lavender"
                title="Add your first service"
                message="List what you offer with price and duration, e.g. a consultation or vaccination."
                action={{ label: 'Add a service', onPress: () => go(`${base}/service`) }}
              />
            </Card>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Opening hours"
            actionLabel="Edit"
            onAction={() => go(`${base}/hours`)}
          />
          <Card style={styles.card} testID="hours-summary">
            {WEEKDAYS_SHORT.map((day, weekday) => {
              const ranges = hours.data?.rules.filter((r) => r.weekday === weekday) ?? [];
              return (
                <View key={day} style={styles.hoursRow}>
                  <Text variant="bodyStrong" style={styles.dayLabel}>
                    {day}
                  </Text>
                  <Text
                    variant="body"
                    color={ranges.length ? 'text' : 'textMuted'}
                    style={styles.hoursText}
                  >
                    {ranges.length
                      ? ranges
                          .map((r) => `${formatTime(r.start_time)} – ${formatTime(r.end_time)}`)
                          .join(',  ')
                      : 'Closed'}
                  </Text>
                </View>
              );
            })}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Days off & special hours"
            actionLabel="Add"
            onAction={() => go(`${base}/day-off`)}
          />
          <Card style={styles.card}>
            {exceptions.data?.length ? (
              exceptions.data.map((e) => (
                <ListRow
                  key={e.id}
                  icon={e.kind === 'closed' ? 'moon' : 'time'}
                  tone={e.kind === 'closed' ? 'coral' : 'lavender'}
                  title={new Date(`${e.on_date}T00:00:00`).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                  subtitle={[
                    e.kind === 'closed'
                      ? 'Closed'
                      : `${formatTime(e.start_time ?? '')} – ${formatTime(e.end_time ?? '')}`,
                    e.note,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    <Button
                      label="Remove"
                      variant="tertiary"
                      onPress={() =>
                        Alert.alert('Remove this day?', undefined, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Remove',
                            style: 'destructive',
                            onPress: () => removeException.mutate(e.id),
                          },
                        ])
                      }
                    />
                  }
                />
              ))
            ) : (
              <Text variant="body" color="textMuted">
                No upcoming days off. Add holidays or special hours here.
              </Text>
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Preview your slots" />
          <Card style={styles.card}>
            {activeServices.length ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {activeServices.map((s) => (
                    <Chip
                      key={s.id}
                      label={s.title}
                      selected={s.id === selectedService}
                      onPress={() => setPreviewService(s.id)}
                    />
                  ))}
                </ScrollView>
                <DayStrip days={days} selected={previewDate} onSelect={setPreviewDate} />
                <SlotGrid
                  slots={slots.data?.slots}
                  loading={slots.isPending}
                  emptyMessage="No slots that day. Check your opening hours and days off."
                />
              </>
            ) : (
              <Text variant="body" color="textMuted">
                Add an active service to preview bookable slots.
              </Text>
            )}
          </Card>
        </View>
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  list: { paddingVertical: spacing.sm, gap: spacing.xs },
  section: { gap: spacing.md },
  heroStats: { flexDirection: 'row', gap: spacing.sm },
  heroStat: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  heroStatLabel: { color: colors.primaryTint },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  inactive: { opacity: 0.6 },
  pressed: { opacity: 0.8 },
  serviceText: { flex: 1, gap: spacing.xxs },
  pills: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xxs },
  hoursRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dayLabel: { width: 44 },
  hoursText: { flex: 1 },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
});
