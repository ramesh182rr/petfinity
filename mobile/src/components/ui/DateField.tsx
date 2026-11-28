import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, touchTarget } from '@/theme';

import { Text } from './Text';

type Props = {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  testID?: string;
};

/** Tappable date pill with a calendar badge (system date picker). */
export function DateField({ label, value, onChange, minimumDate, maximumDate, testID }: Props) {
  const [showIos, setShowIos] = useState(false);
  const text = value.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode: 'date',
        minimumDate,
        maximumDate,
        onChange: (_e, d) => d && onChange(d),
      });
    } else setShowIos((s) => !s);
  };
  return (
    <View style={styles.wrap}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}`}
        style={styles.field}
        testID={testID}
      >
        <View style={styles.badge}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
        </View>
        <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
          {text}
        </Text>
      </Pressable>
      {showIos && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value}
          mode="date"
          display="inline"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onChange={(_e, d) => d && onChange(d)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  field: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  flex: { flex: 1 },
});
