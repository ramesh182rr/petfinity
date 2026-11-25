import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Card } from './Card';
import { Text } from './Text';

/** Titled card grouping related form fields. */
export function FormSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text variant="heading">{title}</Text>
        {note ? (
          <Text variant="caption" color="textMuted">
            {note}
          </Text>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  header: { gap: spacing.xs },
});
