import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, elevation, radius, spacing, type ColorToken } from '@/theme';

type Props = {
  children: ReactNode;
  tone?: Extract<ColorToken, 'surface' | 'surfaceTint' | 'primary' | 'accentSageTint'>;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
};

/** Rounded surface with restrained elevation. Becomes a button when `onPress` is set. */
export function Card({
  children,
  tone = 'surface',
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: Props) {
  const cardStyle = [styles.card, { backgroundColor: colors[tone] }, style];

  if (!onPress) {
    return (
      <View testID={testID} style={cardStyle}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...elevation.card,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
});
