import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { LoadingState } from '@/components/states/StateViews';
import { Button, Card, Screen, Text, TimeField } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { WEEKDAYS } from '@/features/catalog/format';
import { useHours, useSaveHours } from '@/features/catalog/hooks';
import { backToWorkspace } from '@/features/catalog/navigation';
import {
  DEFAULT_RANGE,
  hhmm,
  toRules,
  validateWeek,
  type Range,
  type Week,
} from '@/features/catalog/hours';
import type { OwnerType, Rule } from '@/features/catalog/types';
import { colors, radius, spacing } from '@/theme';

function Stepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <View style={styles.stepper} accessibilityLabel={`${label}: ${value}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Fewer ${label}`}
        hitSlop={8}
        onPress={() => onChange(Math.max(1, value - 1))}
        style={styles.stepButton}
      >
        <Ionicons name="remove" size={18} color={colors.primary} />
      </Pressable>
      <Text variant="label">{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More ${label}`}
        hitSlop={8}
        onPress={() => onChange(Math.min(20, value + 1))}
        style={styles.stepButton}
      >
        <Ionicons name="add" size={18} color={colors.primary} />
      </Pressable>
    </View>
  );
}

function HoursEditor({
  ownerType,
  ownerId,
  initial,
}: {
  ownerType: OwnerType;
  ownerId: string;
  initial: Rule[];
}) {
  const save = useSaveHours(ownerType, ownerId);
  const [week, setWeek] = useState<Week>(() =>
    WEEKDAYS.map((_, day) =>
      initial
        .filter((r) => r.weekday === day)
        .map((r) => ({
          start: hhmm(r.start_time),
          end: hhmm(r.end_time),
          capacity: r.capacity ?? 1,
        })),
    ),
  );
  const [error, setError] = useState<string | null>(null);

  const update = (day: number, fn: (ranges: Range[]) => Range[]) =>
    setWeek((w) => w.map((ranges, d) => (d === day ? fn(ranges) : ranges)));

  const addRange = (day: number) =>
    update(day, (ranges) => {
      const last = ranges[ranges.length - 1];
      if (!last) return [{ ...DEFAULT_RANGE }];
      const [h = 0, m = 0] = last.end.split(':').map(Number);
      const start = Math.min(h + 1, 22);
      const pad = (n: number) => String(n).padStart(2, '0');
      return [
        ...ranges,
        {
          start: `${pad(start)}:${pad(m)}`,
          end: `${pad(Math.min(start + 3, 23))}:${pad(m)}`,
          capacity: last.capacity,
        },
      ];
    });

  const copyMonday = () =>
    setWeek((w) =>
      w.map((ranges, d) => (d >= 1 && d <= 4 ? (w[0] ?? []).map((r) => ({ ...r })) : ranges)),
    );

  const submit = () => {
    const problem = validateWeek(week);
    setError(problem);
    if (problem) return;
    save.mutate(toRules(week), { onSuccess: () => backToWorkspace(ownerType, ownerId) });
  };

  return (
    <View style={styles.form}>
      <Text variant="body" color="textMuted">
        Add one time range per session. Leave a gap for breaks. Capacity is how many appointments
        can run at once.
      </Text>
      <Button
        label="Copy Monday to Tue–Fri"
        icon="copy-outline"
        variant="secondary"
        onPress={copyMonday}
      />
      {WEEKDAYS.map((dayName, day) => {
        const ranges = week[day] ?? [];
        const open = ranges.length > 0;
        return (
          <Card key={dayName} style={styles.dayCard} testID={`day-${day}`}>
            <View style={styles.dayHeader}>
              <Text variant="subheading" style={styles.flex}>
                {dayName}
              </Text>
              <Text variant="caption" color={open ? 'success' : 'textMuted'}>
                {open ? 'Open' : 'Closed'}
              </Text>
              <Switch
                value={open}
                accessibilityLabel={`${dayName} open`}
                onValueChange={(on) => update(day, () => (on ? [{ ...DEFAULT_RANGE }] : []))}
                trackColor={{ true: colors.primarySoft, false: colors.border }}
                thumbColor={open ? colors.primary : colors.surface}
              />
            </View>
            {ranges.map((r, i) => (
              <View key={i} style={styles.range}>
                <View style={styles.rangeRow}>
                  <TimeField
                    label={`${dayName} start`}
                    value={r.start}
                    onChange={(v) =>
                      update(day, (rs) => rs.map((x, j) => (j === i ? { ...x, start: v } : x)))
                    }
                  />
                  <Text variant="body" color="textMuted">
                    to
                  </Text>
                  <TimeField
                    label={`${dayName} end`}
                    value={r.end}
                    onChange={(v) =>
                      update(day, (rs) => rs.map((x, j) => (j === i ? { ...x, end: v } : x)))
                    }
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${dayName} range`}
                    hitSlop={8}
                    onPress={() => update(day, (rs) => rs.filter((_, j) => j !== i))}
                    style={styles.remove}
                  >
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
                <View style={styles.capacityRow}>
                  <Ionicons name="people-outline" size={18} color={colors.primary} />
                  <Text variant="label" color="textMuted" style={styles.flex}>
                    Appointments at once
                  </Text>
                  <Stepper
                    label="parallel appointments"
                    value={r.capacity}
                    onChange={(v) =>
                      update(day, (rs) => rs.map((x, j) => (j === i ? { ...x, capacity: v } : x)))
                    }
                  />
                </View>
              </View>
            ))}
            {open && ranges.length < 6 ? (
              <Button
                label="Add hours"
                icon="add"
                variant="tertiary"
                onPress={() => addRange(day)}
                style={styles.addButton}
              />
            ) : null}
          </Card>
        );
      })}
      {error || save.isError ? (
        <Text variant="body" color="error" accessibilityRole="alert" testID="hours-error">
          {error ?? errorMessage(save.error)}
        </Text>
      ) : null}
      <Button
        testID="hours-save"
        label="Save opening hours"
        size="lg"
        fullWidth
        loading={save.isPending}
        onPress={submit}
      />
    </View>
  );
}

export default function HoursScreen() {
  const params = useLocalSearchParams<{ ownerType: string; id: string }>();
  const ownerType: OwnerType = params.ownerType === 'clinic' ? 'clinic' : 'provider_profile';
  const hours = useHours(ownerType, params.id);
  if (hours.isPending) return <LoadingState message="Loading hours…" />;
  return (
    <Screen edges={[]} testID="hours-screen">
      <HoursEditor ownerType={ownerType} ownerId={params.id} initial={hours.data?.rules ?? []} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  flex: { flex: 1 },
  dayCard: { gap: spacing.md },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  range: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  capacityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  remove: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    borderRadius: radius.pill,
  },
  addButton: { paddingHorizontal: 0 },
});
