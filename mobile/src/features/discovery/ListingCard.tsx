import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { InitialsAvatar, StatusPill, Text } from '@/components/ui';
import { CATEGORY_LABEL, formatRupees } from '@/features/catalog/format';
import { colors, elevation, radius, spacing } from '@/theme';

import { avatarName, slotLabel, whereLabel } from './format';
import type { Listing } from './types';

function categorySummary(listing: Listing): string {
  const labels = listing.categories.map((c) => CATEGORY_LABEL[c]);
  if (labels.length <= 2) return labels.join(' · ');
  return `${labels[0]} +${labels.length - 1} more`;
}

/** One search result: who, where, from-price, open state and the next free slot. */
export function ListingCard({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const isVet = listing.kind === 'vet';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${listing.name}, verified ${isVet ? 'vet' : 'clinic'}, ${whereLabel(listing)}`}
      testID={`listing-${listing.id}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={styles.avatar}>
          <InitialsAvatar name={avatarName(listing.name)} size={52} onDark={false} />
          <View style={styles.kindBadge}>
            <Ionicons name={isVet ? 'home' : 'medkit'} size={12} color={colors.textOnPrimary} />
          </View>
        </View>
        <View style={styles.main}>
          <View style={styles.nameRow}>
            <Text variant="subheading" numberOfLines={1} style={styles.name}>
              {listing.name}
            </Text>
            <Ionicons
              name="shield-checkmark"
              size={16}
              color={colors.success}
              accessibilityLabel="Verified"
            />
          </View>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {whereLabel(listing)}
          </Text>
          <View style={styles.pills}>
            <StatusPill
              label={listing.open_now ? 'Open now' : 'Closed now'}
              tone={listing.open_now ? 'success' : 'neutral'}
            />
            {listing.emergency ? <StatusPill label="Emergency" tone="error" /> : null}
          </View>
        </View>
        {listing.price_from_minor != null ? (
          <View style={styles.price}>
            <Text variant="caption" color="textMuted">
              from
            </Text>
            <Text variant="subheading" color="primary">
              {formatRupees(listing.price_from_minor)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.footer}>
        <View style={styles.footerItem}>
          <Ionicons name="calendar-clear-outline" size={16} color={colors.primary} />
          <Text
            variant="label"
            color={listing.next_slot_at ? 'primary' : 'textMuted'}
            accessibilityLabel={
              listing.next_slot_at
                ? `Next free slot ${slotLabel(listing.next_slot_at)}`
                : 'No free slots this week'
            }
          >
            {listing.next_slot_at ? slotLabel(listing.next_slot_at) : 'Fully booked this week'}
          </Text>
        </View>
        <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.categories}>
          {categorySummary(listing)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation.card,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  avatar: { width: 52, height: 52 },
  kindBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  main: { flex: 1, gap: spacing.xxs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: { flexShrink: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  price: { alignItems: 'flex-end' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  categories: { flex: 1, textAlign: 'right' },
});
