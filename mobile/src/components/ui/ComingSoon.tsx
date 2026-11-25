import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Card } from './Card';
import type { IconBadgeTone } from './IconBadge';
import { ListRow } from './ListRow';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

type Item = {
  icon: ComponentProps<typeof Ionicons>['name'];
  tone: IconBadgeTone;
  title: string;
  subtitle: string;
};

/** Honest preview of a feature that isn't live yet: what it will do, no fake data. */
export function ComingSoon({
  title,
  items,
  testID,
}: {
  title: string;
  items: Item[];
  testID?: string;
}) {
  return (
    <Card testID={testID} style={styles.card}>
      <View style={styles.header}>
        <Text variant="heading" style={styles.title}>
          {title}
        </Text>
        <StatusPill label="Coming soon" tone="primary" />
      </View>
      <View>
        {items.map((item) => (
          <ListRow key={item.title} {...item} />
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { flex: 1 },
});
