import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusPill, Text } from '@/components/ui';
import { colors, elevation, radius, spacing } from '@/theme';

import { dateTile, formatClock, replyBy, STATUS_INFO } from './format';
import type { Booking } from './types';

/**
 * One appointment: a date tile, what and with whom, and its status.
 * Parents see the clinic or vet; providers see the pet parent and a reply-by line for requests.
 */
export function BookingCard({
  booking,
  onPress,
  provider = false,
}: {
  booking: Booking;
  onPress: () => void;
  provider?: boolean;
}) {
  const tile = dateTile(booking.start_at);
  const status = STATUS_INFO[booking.status];
  const label = provider && booking.status === 'pending_provider' ? 'New request' : status.label;
  const active = ['pending_provider', 'confirmed', 'in_progress'].includes(booking.status);
  const pets = booking.pets.map((p) => p.name).join(', ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${booking.service_title} at ${booking.listing.name}, ${tile.weekday} ${tile.day} ${tile.month} ${formatClock(booking.start_at)}, ${label}`}
      testID={`booking-${booking.id}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.tile, !active && styles.tileMuted]}>
        <Text variant="caption" color={active ? 'textOnPrimary' : 'textMuted'}>
          {tile.weekday}
        </Text>
        <Text variant="heading" color={active ? 'textOnPrimary' : 'text'}>
          {tile.day}
        </Text>
        <Text variant="caption" color={active ? 'textOnPrimary' : 'textMuted'}>
          {tile.month}
        </Text>
      </View>
      <View style={styles.main}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {booking.service_title}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {provider
            ? [
                booking.owner_name ?? 'Pet parent',
                booking.service_mode === 'home_visit' ? 'Home visit' : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : booking.listing.name}
        </Text>
        <View style={styles.meta}>
          <Ionicons name="time-outline" size={14} color={colors.primary} />
          <Text variant="label" color="primary">
            {formatClock(booking.start_at)}
          </Text>
          {pets ? (
            <>
              <Ionicons name="paw-outline" size={14} color={colors.textMuted} />
              <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
                {pets}
              </Text>
            </>
          ) : null}
        </View>
        <View style={styles.pills}>
          <StatusPill label={label} tone={status.tone} />
        </View>
        {provider && booking.status === 'pending_provider' && booking.response_deadline ? (
          <Text variant="caption" color="warning" testID={`reply-by-${booking.id}`}>
            {replyBy(booking.response_deadline)}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  tile: {
    width: 64,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  tileMuted: { backgroundColor: colors.backgroundAlt },
  main: { flex: 1, gap: spacing.xxs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xxs },
  flex: { flex: 1 },
  pills: { flexDirection: 'row', marginTop: spacing.xs },
});
