import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, IconBadge, StatusPill, Text } from '@/components/ui';
import {
  CATEGORY_LABEL,
  WEEKDAYS_SHORT,
  categoryTone,
  formatDuration,
  formatRupees,
  formatTime,
} from '@/features/catalog/format';
import { colors, radius, spacing } from '@/theme';

import type { Closure, DayHours, PublicService } from './types';

const hhmm = (t: string) => t.slice(0, 5);
const isAllDay = (day: DayHours) =>
  day.ranges.length === 1 &&
  hhmm(day.ranges[0]?.start_time ?? '') === '00:00' &&
  hhmm(day.ranges[0]?.end_time ?? '') >= '23:55';

function serviceDetails(service: PublicService): string {
  const category = CATEGORY_LABEL[service.category];
  return [
    category !== service.title ? category : null,
    formatDuration(service.duration_minutes),
    service.service_mode === 'home_visit' ? 'Home visit' : 'At the clinic',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A bookable service: badge, title, details, confirmation pill and price. */
export function ServiceRow({
  service,
  selected,
  onPress,
}: {
  service: PublicService;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${service.title}, ${formatRupees(service.price_minor)}, ${formatDuration(service.duration_minutes)}`}
      style={({ pressed }) => [
        styles.service,
        selected && styles.serviceSelected,
        pressed && styles.pressed,
      ]}
      testID={`public-service-${service.id}`}
    >
      <IconBadge name="medkit" tone={categoryTone(service.category)} />
      <View style={styles.serviceText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {service.title}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {serviceDetails(service)}
        </Text>
        <View style={styles.pills}>
          <StatusPill
            label={service.confirmation_mode === 'instant' ? 'Instant booking' : 'On request'}
            tone={service.confirmation_mode === 'instant' ? 'success' : 'warning'}
          />
        </View>
      </View>
      <Text variant="subheading" color="primary">
        {formatRupees(service.price_minor)}
      </Text>
    </Pressable>
  );
}

/** Weekly hours plus the next two weeks' days off and special hours. */
export function HoursCard({ hours, closures }: { hours: DayHours[]; closures: Closure[] }) {
  const today = (new Date().getDay() + 6) % 7;
  return (
    <Card style={styles.card} testID="public-hours">
      {hours.map((day) => (
        <View key={day.weekday} style={styles.hoursRow}>
          <Text
            variant="bodyStrong"
            color={day.weekday === today ? 'primary' : 'text'}
            style={styles.dayLabel}
          >
            {WEEKDAYS_SHORT[day.weekday]}
          </Text>
          <Text variant="body" color={day.ranges.length ? 'text' : 'textMuted'} style={styles.flex}>
            {isAllDay(day)
              ? 'Open 24 hours'
              : day.ranges.length
                ? day.ranges
                    .map(
                      (r) => `${formatTime(hhmm(r.start_time))} – ${formatTime(hhmm(r.end_time))}`,
                    )
                    .join(',  ')
                : 'Closed'}
          </Text>
        </View>
      ))}
      {closures.length ? (
        <View style={styles.closures}>
          {closures.map((c) => (
            <View key={c.on_date} style={styles.closure}>
              <Ionicons
                name={c.kind === 'closed' ? 'moon' : 'time'}
                size={16}
                color={c.kind === 'closed' ? colors.accentCoralText : colors.primary}
              />
              <Text variant="caption" color="textMuted">
                {new Date(`${c.on_date}T00:00:00`).toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
                {': '}
                {c.kind === 'closed'
                  ? 'Closed'
                  : `${formatTime(hhmm(c.start_time ?? ''))} – ${formatTime(hhmm(c.end_time ?? ''))} only`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

/** "Verified by Petfinity" with exactly what was checked (doc 13: the badge says what it means). */
export function BadgeCard({ checks, verifiedAt }: { checks: string[]; verifiedAt: string | null }) {
  const since = verifiedAt
    ? new Date(verifiedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : null;
  return (
    <Card style={styles.badge} testID="verified-badge">
      <IconBadge name="shield-checkmark" tone="sage" />
      <View style={styles.flexGap}>
        <Text variant="bodyStrong">Verified by Petfinity{since ? ` · ${since}` : ''}</Text>
        <Text variant="caption" color="textMuted">
          What we checked:
        </Text>
        {checks.map((check) => (
          <View key={check} style={styles.check}>
            <Ionicons
              name="checkmark-circle"
              size={16}
              color={colors.success}
              style={styles.checkIcon}
            />
            <Text variant="caption" color="text" style={styles.flex}>
              {check}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

/** Three translucent stat tiles that sit inside a gradient hero. */
export function HeroStats({ items }: { items: { value: string; label: string }[] }) {
  return (
    <View style={styles.heroStats}>
      {items.map((item) => (
        <View key={item.label} style={styles.heroStat}>
          <Text variant="subheading" color="textOnPrimary" numberOfLines={1}>
            {item.value}
          </Text>
          <Text variant="caption" style={styles.heroStatLabel} numberOfLines={1}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  flex: { flex: 1 },
  flexGap: { flex: 1, gap: spacing.xs },
  pressed: { opacity: 0.85 },
  service: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  serviceSelected: { borderColor: colors.primary },
  serviceText: { flex: 1, gap: spacing.xxs },
  pills: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xxs },
  hoursRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dayLabel: { width: 44 },
  closures: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  closure: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  checkIcon: { marginTop: 1 },
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
});
