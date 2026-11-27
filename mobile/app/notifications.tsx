import { router, Stack, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/states/StateViews';
import { Button, Card, HeroScreen, IconBadge, Text } from '@/components/ui';
import { notificationIcon, sectionFor, timeAgo } from '@/features/notifications/format';
import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/hooks';
import {
  pushPermission,
  PUSH_MESSAGES,
  setUpPush,
  type PushState,
} from '@/features/notifications/push';
import type { AppNotification } from '@/features/notifications/types';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, radius, spacing } from '@/theme';

function PushCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void pushPermission().then(setState);
  }, []);
  if (state === null || (state === 'granted' && !message)) return null;
  const turnOn = async () => {
    setBusy(true);
    const result = await setUpPush({ ask: true });
    setBusy(false);
    setState(await pushPermission());
    setMessage(result.ok ? null : PUSH_MESSAGES[result.reason]);
  };
  return (
    <Card style={styles.push} testID="push-card">
      <View style={styles.row}>
        <IconBadge name="notifications" tone="peach" />
        <View style={styles.flex}>
          <Text variant="bodyStrong">Get reminders on your phone</Text>
          <Text variant="caption" color="textMuted">
            We’ll let you know when a visit is confirmed and remind you before it starts.
          </Text>
        </View>
      </View>
      {state === 'undetermined' ? (
        <Button
          label="Turn on notifications"
          icon="notifications"
          loading={busy}
          onPress={() => void turnOn()}
          fullWidth
          testID="push-enable"
        />
      ) : null}
      {message || state === 'denied' ? (
        <Text variant="caption" color="textMuted" testID="push-message">
          {message ?? PUSH_MESSAGES.denied}
        </Text>
      ) : null}
    </Card>
  );
}

function NotificationRow({ note, onPress }: { note: AppNotification; onPress: () => void }) {
  const { icon, tone } = notificationIcon(note.kind);
  const unread = !note.read_at;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${note.title}. ${note.body}`}
      style={({ pressed }) => [styles.note, unread && styles.unread, pressed && styles.pressed]}
      testID={`notification-${note.id}`}
    >
      <IconBadge name={icon} tone={tone} />
      <View style={styles.flex}>
        <View style={styles.titleRow}>
          <Text variant={unread ? 'bodyStrong' : 'body'} style={styles.flex} numberOfLines={2}>
            {note.title}
          </Text>
          <Text variant="caption" color="textMuted">
            {timeAgo(note.created_at)}
          </Text>
        </View>
        <Text variant="caption" color="textMuted" numberOfLines={3}>
          {note.body}
        </Text>
      </View>
      {unread ? <View style={styles.dot} accessibilityElementsHidden /> : null}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const list = useNotifications();
  const unread = useUnreadCount();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  useRefreshOnFocus(list.refetch, unread.refetch);

  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const count = unread.data ?? list.data?.pages[0]?.unread_count ?? 0;
  const sections = (['Today', 'Earlier'] as const)
    .map((title) => ({ title, items: items.filter((n) => sectionFor(n.created_at) === title) }))
    .filter((s) => s.items.length);

  const open = (note: AppNotification) => {
    if (!note.read_at) markRead.mutate(note.id);
    const route = (note.data as { route?: unknown }).route;
    if (typeof route === 'string' && route.startsWith('/')) router.push(route as Href);
  };

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="notifications-screen"
        underHeader
        eyebrow="Notifications"
        title={count ? `${count} new` : 'All caught up'}
        subtitle="Booking updates and reminders, for you and your practice."
        overlap
        refreshControl={
          <RefreshControl
            refreshing={list.isRefetching && !list.isFetchingNextPage}
            onRefresh={() => void list.refetch()}
            tintColor={colors.primary}
          />
        }
        accessory={
          count ? (
            <Button
              label="Mark all read"
              variant="outlineInverse"
              loading={markAll.isPending}
              onPress={() => markAll.mutate()}
              testID="mark-all-read"
            />
          ) : undefined
        }
      >
        <PushCard />
        {list.isPending ? (
          <Card style={styles.list}>
            <Skeleton height={64} />
            <Skeleton height={64} />
            <Skeleton height={64} />
          </Card>
        ) : list.isError ? (
          <Card>
            <ErrorState
              onRetry={() => void list.refetch()}
              requestId={isApiError(list.error) ? list.error.requestId : null}
            />
          </Card>
        ) : items.length ? (
          <>
            {sections.map((section) => (
              <Card key={section.title} style={styles.list}>
                <Text variant="label" color="textMuted" style={styles.heading}>
                  {section.title.toUpperCase()}
                </Text>
                {section.items.map((note) => (
                  <NotificationRow key={note.id} note={note} onPress={() => open(note)} />
                ))}
              </Card>
            ))}
            {list.hasNextPage ? (
              <Button
                label="Show older"
                variant="secondary"
                loading={list.isFetchingNextPage}
                onPress={() => void list.fetchNextPage()}
                fullWidth
              />
            ) : null}
          </>
        ) : (
          <Card testID="notifications-empty">
            <EmptyState
              compact
              icon="notifications-outline"
              tone="lavender"
              title="Nothing yet"
              message="Confirmations, changes and reminders for your appointments will appear here."
            />
          </Card>
        )}
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xxs },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  push: { gap: spacing.md },
  heading: { paddingHorizontal: spacing.sm, paddingTop: spacing.xs, letterSpacing: 1 },
  list: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, gap: spacing.xs },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
  },
  unread: { backgroundColor: colors.primaryTint },
  pressed: { opacity: 0.85 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    marginTop: spacing.xs,
    backgroundColor: colors.primary,
  },
});
