import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

const STAR = colors.ratingStar;
const LABELS = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Read-only stars; supports halves for averages like 4.5. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${value.toFixed(1).replace('.0', '')} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          size={size}
          color={STAR}
          name={value >= n ? 'star' : value >= n - 0.5 ? 'star-half' : 'star-outline'}
        />
      ))}
    </View>
  );
}

/** Tappable 1–5 picker with 48dp targets. */
export function StarInput({
  value,
  onChange,
  testID,
}: {
  value: number;
  onChange: (n: number) => void;
  testID?: string;
}) {
  return (
    <View style={styles.input} accessibilityRole="radiogroup" testID={testID}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n)}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === n }}
          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}, ${LABELS[n - 1]}`}
          style={styles.target}
          testID={testID ? `${testID}-${n}` : undefined}
        >
          <Ionicons name={value >= n ? 'star' : 'star-outline'} size={36} color={STAR} />
        </Pressable>
      ))}
    </View>
  );
}

export const ratingLabel = (n: number) => LABELS[n - 1] ?? '';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  input: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  target: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    backgroundColor: colors.surface,
  },
});
