import { StyleSheet, View } from 'react-native';

import { colors, fonts } from '@/theme';

import { Text } from './Text';

/** Circular initials avatar with a soft ring (used on dark headers by default). */
export function InitialsAvatar({
  name,
  size = 48,
  onDark = true,
}: {
  name: string | null | undefined;
  size?: number;
  onDark?: boolean;
}) {
  const initials =
    (name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '🐾';
  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
        onDark ? styles.ringDark : styles.ringLight,
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.displaySemiBold,
          fontSize: size * 0.36,
          color: onDark ? colors.textOnPrimary : colors.primary,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  ringDark: { backgroundColor: 'rgba(255,255,255,0.16)', borderColor: 'rgba(255,255,255,0.55)' },
  ringLight: { backgroundColor: colors.primaryTint, borderColor: colors.primarySoft },
});
