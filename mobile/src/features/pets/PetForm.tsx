import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Button, Card, Chip, SegmentedControl, Text, TextField } from '@/components/ui';
import { colors, radius, spacing, touchTarget } from '@/theme';

import { formatDate, SPECIES_OPTIONS, toIsoDate } from './format';
import { petFormSchema, toPetPayload, type PetFormValues } from './schema';
import type { PetCreate } from './types';

type Props = {
  initialValues: PetFormValues;
  submitLabel: string;
  submitting: boolean;
  serverError?: string;
  onSubmit: (payload: PetCreate) => void;
};

const SEX_OPTIONS = [
  { value: 'female' as const, label: 'Female' },
  { value: 'male' as const, label: 'Male' },
  { value: 'unknown' as const, label: 'Not sure' },
];
const NEUTERED_OPTIONS = [
  { value: 'yes' as const, label: 'Yes' },
  { value: 'no' as const, label: 'No' },
  { value: 'unknown' as const, label: 'Not sure' },
];

export function PetForm({ initialValues, submitLabel, submitting, serverError, onSubmit }: Props) {
  const { control, handleSubmit, setValue, formState } = useForm<PetFormValues>({
    resolver: zodResolver(petFormSchema),
    defaultValues: initialValues,
  });
  const errors = formState.errors;
  const species = useWatch({ control, name: 'species' });
  const dateOfBirth = useWatch({ control, name: 'dateOfBirth' });
  const [showIosPicker, setShowIosPicker] = useState(false);

  const submit = handleSubmit((values) => onSubmit(toPetPayload(petFormSchema.parse(values))));

  const openDatePicker = () => {
    const value = dateOfBirth ?? new Date();
    const onChange = (_event: unknown, date?: Date) => {
      if (date) setValue('dateOfBirth', date, { shouldValidate: true, shouldDirty: true });
    };
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value, mode: 'date', maximumDate: new Date(), onChange });
    } else {
      setShowIosPicker((shown) => !shown);
    }
  };

  const text = (
    name: keyof PetFormValues,
    label: string,
    options: Partial<React.ComponentProps<typeof TextField>> = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <TextField
          testID={`pet-${name}`}
          label={label}
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          onBlur={onBlur}
          error={errors[name]?.message}
          {...options}
        />
      )}
    />
  );

  return (
    <View style={styles.form}>
      <Section title="Basics">
        {text('name', 'Name', {
          placeholder: 'e.g. Bruno',
          autoCapitalize: 'words',
          maxLength: 50,
        })}

        <View style={styles.field}>
          <Text variant="label">Species</Text>
          <Controller
            control={control}
            name="species"
            render={({ field: { onChange, value } }) => (
              <View
                style={styles.chips}
                accessibilityRole="radiogroup"
                accessibilityLabel="Species"
              >
                {SPECIES_OPTIONS.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    selected={value === option.value}
                    onPress={() => onChange(option.value)}
                    testID={`species-${option.value}`}
                  />
                ))}
              </View>
            )}
          />
        </View>
        {species === 'other'
          ? text('speciesOther', 'What kind of pet?', {
              placeholder: 'e.g. Hedgehog',
              maxLength: 40,
            })
          : null}
        {text('breed', 'Breed (optional)', {
          placeholder: 'e.g. Indie, Persian, Labrador',
          maxLength: 80,
        })}

        <View style={styles.field}>
          <Text variant="label">Sex</Text>
          <Controller
            control={control}
            name="sex"
            render={({ field: { onChange, value } }) => (
              <SegmentedControl
                accessibilityLabel="Sex"
                options={SEX_OPTIONS}
                value={value}
                onChange={onChange}
              />
            )}
          />
        </View>

        <View style={styles.field}>
          <Text variant="label">Date of birth (optional)</Text>
          <Pressable
            onPress={openDatePicker}
            accessibilityRole="button"
            accessibilityLabel={
              dateOfBirth
                ? `Date of birth ${formatDate(toIsoDate(dateOfBirth))}`
                : 'Add date of birth'
            }
            style={[styles.dateField, errors.dateOfBirth && styles.dateFieldError]}
            testID="pet-dateOfBirth"
          >
            <Text variant="body" color={dateOfBirth ? 'text' : 'textMuted'}>
              {dateOfBirth ? formatDate(toIsoDate(dateOfBirth)) : 'Select a date'}
            </Text>
          </Pressable>
          {showIosPicker && Platform.OS === 'ios' ? (
            <DateTimePicker
              value={dateOfBirth ?? new Date()}
              mode="date"
              display="inline"
              maximumDate={new Date()}
              onChange={(_e, date) =>
                date && setValue('dateOfBirth', date, { shouldValidate: true })
              }
            />
          ) : null}
          {errors.dateOfBirth?.message ? (
            <Text variant="caption" color="error">
              {errors.dateOfBirth.message}
            </Text>
          ) : null}
          {dateOfBirth ? (
            <View style={styles.inlineRow}>
              <Controller
                control={control}
                name="dateOfBirthIsEstimate"
                render={({ field: { onChange, value } }) => (
                  <View style={styles.switchRow}>
                    <Switch
                      value={value}
                      onValueChange={onChange}
                      accessibilityLabel="This date is an estimate"
                      trackColor={{ true: colors.primarySoft, false: colors.border }}
                      thumbColor={value ? colors.primary : colors.surface}
                    />
                    <Text variant="body">It&apos;s an estimate</Text>
                  </View>
                )}
              />
              <Button
                variant="tertiary"
                label="Clear"
                onPress={() => setValue('dateOfBirth', null, { shouldDirty: true })}
              />
            </View>
          ) : null}
        </View>

        {text('weightKg', 'Weight in kg (optional)', {
          placeholder: 'e.g. 12.5',
          keyboardType: 'decimal-pad',
        })}

        <View style={styles.field}>
          <Text variant="label">Spayed / neutered?</Text>
          <Controller
            control={control}
            name="neutered"
            render={({ field: { onChange, value } }) => (
              <SegmentedControl
                accessibilityLabel="Spayed or neutered"
                options={NEUTERED_OPTIONS}
                value={value}
                onChange={onChange}
              />
            )}
          />
        </View>
      </Section>

      <Section
        title="Health & care"
        note="Only you can see these details. You'll choose what to share when you book care."
      >
        {text('temperament', 'Temperament', {
          placeholder: 'e.g. Friendly, nervous around other dogs',
          multiline: true,
          maxLength: 500,
        })}
        {text('dietaryNotes', 'Diet', {
          placeholder: 'Food, portions, treats to avoid',
          multiline: true,
          maxLength: 1000,
        })}
        {text('allergies', 'Allergies', { multiline: true, maxLength: 1000 })}
        {text('knownConditions', 'Known conditions', { multiline: true, maxLength: 1000 })}
        {text('medications', 'Medications', {
          placeholder: 'Name, dose and timing',
          multiline: true,
          maxLength: 1000,
        })}
      </Section>

      <Section
        title="Emergency contact"
        note="Someone a caretaker can reach if they can't reach you."
      >
        {text('emergencyContactName', 'Name', { autoCapitalize: 'words', maxLength: 60 })}
        {text('emergencyContactPhone', 'Phone', {
          keyboardType: 'phone-pad',
          placeholder: '98765 43210',
        })}
      </Section>

      {serverError ? (
        <Text variant="body" color="error" accessibilityRole="alert" testID="pet-form-error">
          {serverError}
        </Text>
      ) : null}
      <Button
        testID="pet-form-submit"
        label={submitLabel}
        size="lg"
        fullWidth
        loading={submitting}
        onPress={() => void submit()}
      />
    </View>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.section}>
      <Text variant="subheading">{title}</Text>
      {note ? (
        <Text variant="caption" color="textMuted">
          {note}
        </Text>
      ) : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  section: { gap: spacing.lg },
  field: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateField: {
    minHeight: touchTarget + 4,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  dateFieldError: { borderColor: colors.error },
  inlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
