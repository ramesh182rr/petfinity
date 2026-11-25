import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Button, ChipGroup, FormSection, Text, TextField } from '@/components/ui';
import { spacing } from '@/theme';

import { COUNCILS, LANGUAGES } from './labels';
import type { ProviderProfile, ProviderProfileUpdate, ProviderType } from './types';

const schema = z.object({
  displayName: z.string().trim().min(2, 'Enter the name clients will see.').max(80),
  bio: z.string().trim().max(1000),
  yearsExperience: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d{1,2}$/.test(v) && Number(v) <= 70),
      'Enter years between 0 and 70.',
    ),
  languages: z.array(z.string()).max(10),
  city: z.string().trim().max(80),
  registrationNumber: z.string().trim().max(50),
  registrationCouncil: z.string().trim().max(120),
  qualifications: z.string().trim().max(200),
});
type Values = z.infer<typeof schema>;

const nullIfEmpty = (v: string) => (v.trim() ? v.trim() : null);

export function toProfilePayload(values: Values, type: ProviderType): ProviderProfileUpdate {
  const base: ProviderProfileUpdate = {
    display_name: values.displayName.trim(),
    bio: nullIfEmpty(values.bio),
    years_experience: values.yearsExperience ? Number(values.yearsExperience) : null,
    languages: values.languages,
    city: nullIfEmpty(values.city),
  };
  if (type === 'veterinarian') {
    base.registration_number = nullIfEmpty(values.registrationNumber);
    base.registration_council = nullIfEmpty(values.registrationCouncil);
    base.qualifications = nullIfEmpty(values.qualifications);
  }
  return base;
}

type Props = {
  type: ProviderType;
  initial?: ProviderProfile;
  submitLabel: string;
  submitting: boolean;
  serverError?: string;
  onSubmit: (payload: ProviderProfileUpdate) => void;
};

export function ProviderProfileForm({
  type,
  initial,
  submitLabel,
  submitting,
  serverError,
  onSubmit,
}: Props) {
  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: initial?.display_name ?? '',
      bio: initial?.bio ?? '',
      yearsExperience: initial?.years_experience != null ? String(initial.years_experience) : '',
      languages: initial?.languages ?? [],
      city: initial?.city ?? '',
      registrationNumber: initial?.registration_number ?? '',
      registrationCouncil: initial?.registration_council ?? '',
      qualifications: initial?.qualifications ?? '',
    },
  });
  const e = formState.errors;
  const isVet = type === 'veterinarian';
  const submit = handleSubmit((values) => onSubmit(toProfilePayload(values, type)));

  const field = (
    name: keyof Values,
    label: string,
    props: Partial<React.ComponentProps<typeof TextField>> = {},
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur } }) => (
        <TextField
          testID={`provider-${name}`}
          label={label}
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          onBlur={onBlur}
          error={e[name]?.message}
          {...props}
        />
      )}
    />
  );

  return (
    <View style={styles.form}>
      <FormSection
        title="Your public profile"
        note="This is what pet parents see once you're verified."
      >
        {field('displayName', isVet ? 'Name (e.g. Dr. Priya Nair)' : 'Name', {
          autoCapitalize: 'words',
          maxLength: 80,
        })}
        {field('bio', 'About you', {
          multiline: true,
          maxLength: 1000,
          placeholder: isVet
            ? 'Your focus, e.g. small animals, surgery'
            : 'Your experience with pets',
        })}
        <View style={styles.row}>
          <View style={styles.flex}>
            {field('yearsExperience', 'Years of experience', {
              keyboardType: 'number-pad',
              maxLength: 2,
            })}
          </View>
          <View style={styles.flex}>
            {field('city', 'City', { autoCapitalize: 'words', placeholder: 'e.g. Chennai' })}
          </View>
        </View>
        <Controller
          control={control}
          name="languages"
          render={({ field: { value, onChange } }) => (
            <ChipGroup
              label="Languages you speak"
              options={LANGUAGES}
              selected={value}
              onToggle={(lang) =>
                onChange(value.includes(lang) ? value.filter((l) => l !== lang) : [...value, lang])
              }
            />
          )}
        />
      </FormSection>

      {isVet ? (
        <FormSection
          title="Registration"
          note="Checked against your veterinary council certificate. Changing these after verification needs a re-check."
        >
          {field('registrationNumber', 'Registration number', {
            autoCapitalize: 'characters',
            placeholder: 'e.g. TNSVC/1234',
          })}
          <Controller
            control={control}
            name="registrationCouncil"
            render={({ field: { value, onChange } }) => (
              <ChipGroup
                label="Council"
                options={COUNCILS}
                selected={[value]}
                onToggle={(c) => onChange(c === value ? '' : c)}
              />
            )}
          />
          {field('qualifications', 'Qualifications', { placeholder: 'e.g. B.V.Sc. & A.H.' })}
        </FormSection>
      ) : null}

      {serverError ? (
        <Text variant="body" color="error" accessibilityRole="alert">
          {serverError}
        </Text>
      ) : null}
      <Button
        testID="provider-submit"
        label={submitLabel}
        size="lg"
        fullWidth
        loading={submitting}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
});
