import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  FormSection,
  Screen,
  SegmentedControl,
  Text,
  TextField,
  TimeField,
} from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { useAddException } from '@/features/catalog/hooks';
import { backToWorkspace } from '@/features/catalog/navigation';
import type { OwnerType } from '@/features/catalog/types';
import { formatDate, toIsoDate } from '@/features/pets/format';
import { colors, radius, spacing, touchTarget } from '@/theme';

export default function DayOffScreen() {
  const params = useLocalSearchParams<{ ownerType: string; id: string }>();
  const ownerType: OwnerType = params.ownerType === 'clinic' ? 'clinic' : 'provider_profile';
  const add = useAddException(ownerType, params.id);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [day, setDay] = useState<Date>(tomorrow);
  const [kind, setKind] = useState<'closed' | 'custom_hours'>('closed');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('13:00');
  const [note, setNote] = useState('');
  const [showIos, setShowIos] = useState(false);

  const pickDate = () => {
    const onChange = (_e: unknown, d?: Date) => d && setDay(d);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: day, mode: 'date', minimumDate: new Date(), onChange });
    } else setShowIos((s) => !s);
  };

  return (
    <Screen edges={[]} testID="day-off-screen">
      <FormSection title="Which day?">
        <Pressable
          onPress={pickDate}
          accessibilityRole="button"
          accessibilityLabel={`Date ${formatDate(toIsoDate(day))}`}
          style={styles.dateField}
        >
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          </View>
          <Text variant="bodyStrong" style={styles.flex}>
            {day.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </Pressable>
        {showIos && Platform.OS === 'ios' ? (
          <DateTimePicker
            value={day}
            mode="date"
            display="inline"
            minimumDate={new Date()}
            onChange={(_e, d) => d && setDay(d)}
          />
        ) : null}
        <SegmentedControl
          accessibilityLabel="Type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'closed', label: 'Closed all day' },
            { value: 'custom_hours', label: 'Special hours' },
          ]}
        />
        {kind === 'custom_hours' ? (
          <View style={styles.row}>
            <TimeField label="Opens" value={start} onChange={setStart} />
            <Text variant="body" color="textMuted">
              to
            </Text>
            <TimeField label="Closes" value={end} onChange={setEnd} />
          </View>
        ) : null}
        <TextField
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          maxLength={120}
          placeholder="e.g. Pongal holiday"
        />
        <Text variant="caption" color="textMuted">
          {kind === 'closed'
            ? 'No slots will be offered that day.'
            : 'These hours replace your usual hours for that day.'}
        </Text>
      </FormSection>
      {add.isError ? (
        <Text variant="body" color="error" accessibilityRole="alert">
          {errorMessage(add.error)}
        </Text>
      ) : null}
      <Button
        testID="day-off-save"
        label="Save"
        size="lg"
        fullWidth
        loading={add.isPending}
        onPress={() =>
          add.mutate(
            {
              on_date: toIsoDate(day),
              kind,
              start_time: kind === 'custom_hours' ? start : null,
              end_time: kind === 'custom_hours' ? end : null,
              capacity: kind === 'custom_hours' ? 1 : null,
              note: note.trim() || null,
            },
            { onSuccess: () => backToWorkspace(ownerType, params.id) },
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dateField: {
    minHeight: touchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  dateBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
});
