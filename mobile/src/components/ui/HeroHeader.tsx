import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gradients, palette, radius, spacing, type GradientToken } from '@/theme';

import { Decor } from './Decor';
import { Text } from './Text';

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  gradient?: Extract<GradientToken, 'primary' | 'dusk'>;
  /** Content placed on the right of the title row (e.g. an avatar button). */
  accessory?: ReactNode;
  /** Extra content inside the header (stats, actions). */
  children?: ReactNode;
  /** Adds the top safe-area inset (use when the screen has no navigation header). */
  edgeToEdge?: boolean;
  /** Extra top space for screens with a transparent navigation header (back button). */
  underHeader?: boolean;
  style?: ViewStyle;
  testID?: string;
};

/** Signature Petfinity header: plum gradient, soft bubbles, rounded bottom corners. */
export function HeroHeader({
  eyebrow,
  title,
  subtitle,
  gradient = 'primary',
  accessory,
  children,
  edgeToEdge = false,
  underHeader = false,
  style,
  testID,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      testID={testID}
      colors={gradients[gradient]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.header,
        { paddingTop: (edgeToEdge ? insets.top : 0) + (underHeader ? 52 : 0) + spacing.xl },
        style,
      ]}
    >
      <Decor
        bubbles={[
          { size: 180, color: palette.plum300, top: -60, right: -50, opacity: 0.22 },
          { size: 90, color: palette.coral400, bottom: -30, right: 60, opacity: 0.2 },
          { size: 56, color: palette.peach400, top: 30, left: -20, opacity: 0.16 },
        ]}
      />
      <View style={styles.titleRow}>
        <View style={styles.titles}>
          {eyebrow ? (
            <Text variant="eyebrow" style={styles.eyebrow}>
              {eyebrow}
            </Text>
          ) : null}
          <Text variant="display" color="textOnPrimary">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {accessory}
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    overflow: 'hidden',
    gap: spacing.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  titles: { flex: 1, gap: spacing.xs },
  eyebrow: { color: colors.primaryTint, opacity: 0.85 },
  subtitle: { color: colors.primaryTint, opacity: 0.92 },
});
