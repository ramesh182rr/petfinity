import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/states/StateViews';
import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

import { formatTime } from './format';

type Day = { iso: string; label: string; weekday: string };

/** Horizontal strip of date chips (weekday over "Today" / "Tomorrow" / "27 Nov"). */
export function DayStrip({
  days,
  selected,
  onSelect,
}: {
  days: Day[];
  selected: string;
  onSelect: (iso: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID="day-strip"
    >
      {days.map((d) => {
        const isSelected = d.iso === selected;
        return (
          <Pressable
            key={d.iso}
            onPress={() => onSelect(d.iso)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${d.weekday} ${d.label}`}
            style={[styles.day, isSelected && styles.daySelected]}
          >
            <Text variant="caption" color={isSelected ? 'textOnPrimary' : 'textMuted'}>
              {d.weekday}
            </Text>
            <Text variant="label" color={isSelected ? 'textOnPrimary' : 'text'}>
              {d.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Three-column grid of slot times; loading skeleton and an empty message built in. */
export function SlotGrid({
  slots,
  loading,
  emptyMessage,
  selected,
  onSelect,
}: {
  slots: { start: string; local_start: string }[] | undefined;
  loading: boolean;
  emptyMessage: string;
  selected?: string | null;
  onSelect?: (start: string) => void;
}) {
  if (loading) return <Skeleton height={40} />;
  if (!slots?.length) {
    return (
      <Text variant="body" color="textMuted">
        {emptyMessage}
      </Text>
    );
  }
  return (
    <View style={styles.grid} testID="slot-grid">
      {slots.map((s) => {
        const isSelected = s.start === selected;
        return (
          <Pressable
            key={s.start}
            disabled={!onSelect}
            onPress={() => onSelect?.(s.start)}
            accessibilityRole={onSelect ? 'button' : 'text'}
            accessibilityState={onSelect ? { selected: isSelected } : undefined}
            style={[styles.slot, isSelected && styles.slotSelected]}
          >
            <Text variant="label" color={isSelected ? 'textOnPrimary' : 'primary'}>
              {formatTime(s.local_start)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingRight: spacing.lg },
  day: {
    width: 88,
    minHeight: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  daySelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  slot: {
    width: '30.5%',
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  slotSelected: { backgroundColor: colors.primary },
});
