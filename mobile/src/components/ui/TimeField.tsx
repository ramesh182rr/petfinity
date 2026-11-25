import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatTime, fromHHMM, snapToFive, toHHMM } from '@/features/catalog/format';
import { colors, radius, spacing, touchTarget } from '@/theme';

import { Text } from './Text';

type Props = { label: string; value: string; onChange: (hhmm: string) => void; testID?: string };

/** Compact time pill that opens the native time picker; snaps to 5-minute steps. */
export function TimeField({ label, value, onChange, testID }: Props) {
  const [showIos, setShowIos] = useState(false);
  const apply = (date?: Date) => date && onChange(toHHMM(snapToFive(date)));
  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: fromHHMM(value),
        mode: 'time',
        minuteInterval: 5,
        onChange: (_e, d) => apply(d),
      });
    } else {
      setShowIos((s) => !s);
    }
  };
  return (
    <View>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatTime(value)}`}
        style={styles.pill}
        testID={testID}
      >
        <Ionicons name="time-outline" size={16} color={colors.primary} />
        <Text variant="label">{formatTime(value)}</Text>
      </Pressable>
      {showIos && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={fromHHMM(value)}
          mode="time"
          display="spinner"
          minuteInterval={5}
          onChange={(_e, d) => apply(d)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: touchTarget - 4,
    minWidth: 104,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
  },
});
