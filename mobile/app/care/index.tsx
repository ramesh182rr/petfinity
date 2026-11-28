import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/states/StateViews';
import {
  Button,
  Card,
  HeroScreen,
  IconBadge,
  SegmentedControl,
  StatusPill,
  Text,
} from '@/components/ui';
import {
  CARE_LABEL,
  careDates,
  careWhen,
  petsLabel,
  REQUEST_STATUS,
  unitsLabel,
} from '@/features/care/format';
import { useCareRequests } from '@/features/care/hooks';
import type { CareRequest } from '@/features/care/types';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, elevation, radius, spacing } from '@/theme';

function RequestCard({ r }: { r: CareRequest }) {
  const t = CARE_LABEL[r.care_type];
  const status = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.open!;
  const pending = r.offers.filter((o) => o.status === 'pending').length;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/care/[id]', params: { id: r.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${t.label}, ${careWhen(r.start_at, r.end_at)}, ${status.label}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`care-request-${r.id}`}
    >
      <IconBadge name={t.icon} tone={t.tone} />
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {t.label} · {unitsLabel(r.units, r.unit)}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {careDates(r.start_at, r.end_at)}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {petsLabel(r.pets)} · {r.locality}
        </Text>
        <View style={styles.pills}>
          <StatusPill label={status.label} tone={status.tone} />
          {r.status === 'open' ? (
            <StatusPill
              label={
                pending ? `${pending} ${pending === 1 ? 'offer' : 'offers'}` : 'Waiting for offers'
              }
              tone={pending ? 'success' : 'warning'}
            />
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

/** Parent: "Find a caretaker" home (3.4). */
export default function CareRequestsScreen() {
  const [scope, setScope] = useState<'active' | 'past'>('active');
  const list = useCareRequests(scope);
  useRefreshOnFocus(list.refetch);
  const items = list.data?.items ?? [];

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="care-requests"
        underHeader
        eyebrow="Caretakers"
        title="Find a caretaker"
        subtitle="Tell us what you need. Verified caretakers nearby send offers; you choose."
        gradient="dusk"
        overlap
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching}
            onRefresh={() => void list.refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <Card style={styles.cta}>
          <View style={styles.row}>
            <IconBadge name="paper-plane" tone="peach" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">Home visits, day care, boarding or sitting</Text>
              <Text variant="caption" color="textMuted">
                Post once and get up to 5 offers within a day.
              </Text>
            </View>
          </View>
          <Button
            label="New request"
            icon="add"
            fullWidth
            onPress={() => router.push('/care/new')}
            testID="care-new-button"
          />
        </Card>
        <Card>
          <SegmentedControl<'active' | 'past'>
            accessibilityLabel="Show"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'active', label: 'Open' },
              { value: 'past', label: 'Past' },
            ]}
          />
        </Card>
        {list.isPending ? (
          <View style={styles.list}>
            <Skeleton height={104} />
            <Skeleton height={104} />
          </View>
        ) : list.isError ? (
          <Card>
            <ErrorState
              onRetry={() => void list.refetch()}
              requestId={isApiError(list.error) ? list.error.requestId : null}
            />
          </Card>
        ) : items.length ? (
          <View style={styles.list}>
            {items.map((r) => (
              <RequestCard key={r.id} r={r} />
            ))}
          </View>
        ) : (
          <Card testID="care-requests-empty">
            <EmptyState
              compact
              icon={scope === 'active' ? 'heart-outline' : 'time-outline'}
              tone="sage"
              title={scope === 'active' ? 'No open requests' : 'Nothing here yet'}
              message={
                scope === 'active'
                  ? 'Post a request and caretakers near you will reply with offers.'
                  : 'Booked, cancelled and expired requests show up here.'
              }
            />
          </Card>
        )}
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xxs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cta: { gap: spacing.md },
  list: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
});
