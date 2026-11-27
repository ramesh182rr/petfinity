import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

import { eventLabel, formatWhen } from './format';
import type { BookingEvent } from './types';

const ACTOR: Record<string, string> = {
  owner: 'Pet parent',
  provider: 'Provider',
  admin: 'Petfinity',
  system: 'Automatic',
};

/** The booking's history (booking events), newest last. */
export function Timeline({
  events,
  showActor = false,
}: {
  events: BookingEvent[];
  showActor?: boolean;
}) {
  return (
    <Card style={styles.card} testID="timeline">
      {events.map((e, i) => (
        <View key={`${e.created_at}-${i}`} style={styles.event}>
          <View style={styles.rail}>
            <View style={[styles.dot, i === events.length - 1 && styles.dotLatest]} />
            {i < events.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.text}>
            <Text variant="label">{eventLabel(e.event, e.to_status)}</Text>
            <Text variant="caption" color="textMuted">
              {[formatWhen(e.created_at), showActor ? ACTOR[e.actor_role] : null, e.reason]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 0 },
  event: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 14, alignItems: 'center' },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    marginTop: 4,
    backgroundColor: colors.primarySoft,
  },
  dotLatest: { backgroundColor: colors.primary },
  line: { flex: 1, width: 2, marginVertical: 2, backgroundColor: colors.border },
  text: { flex: 1, gap: spacing.xxs, paddingBottom: spacing.md },
});
