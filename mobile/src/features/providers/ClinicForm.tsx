import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Switch, View } from 'react-native';
import { z } from 'zod';

import { Button, ChipGroup, FormSection, Text, TextField } from '@/components/ui';
import { normalizeIndianContact } from '@/features/auth/identifiers';
import { colors, spacing } from '@/theme';

import { STATES } from './labels';
import type { Clinic, ClinicCreate } from './types';

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the clinic name.').max(120),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => normalizeIndianContact(v) !== null,
      'Enter a valid phone number (landline or mobile).',
    ),
  email: z.union([z.literal(''), z.email('Enter a valid email address.')]),
  addressLine1: z.string().trim().min(3, 'Enter the street address.').max(200),
  addressLine2: z.string().trim().max(200),
  locality: z.string().trim().max(100),
  city: z.string().trim().min(2, 'Enter the city.').max(80),
  state: z.string().trim().min(2, 'Choose or enter the state.').max(60),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code.'),
  emergencyServices: z.boolean(),
  practisesHere: z.boolean(),
});
type Values = z.infer<typeof schema>;

const nullIfEmpty = (v: string) => (v.trim() ? v.trim() : null);

export function toClinicPayload(v: Values, includePractises: boolean): ClinicCreate {
  return {
    name: v.name.trim(),
    phone: normalizeIndianContact(v.phone) ?? v.phone,
    email: nullIfEmpty(v.email),
    address_line1: v.addressLine1.trim(),
    address_line2: nullIfEmpty(v.addressLine2),
    locality: nullIfEmpty(v.locality),
    city: v.city.trim(),
    state: v.state.trim(),
    postal_code: v.postalCode.trim(),
    emergency_services: v.emergencyServices,
    practises_here: includePractises && v.practisesHere,
  };
}

type Props = {
  initial?: Clinic;
  canPractise: boolean;
  submitLabel: string;
  submitting: boolean;
  serverError?: string;
  onSubmit: (payload: ClinicCreate) => void;
};

export function ClinicForm({
  initial,
  canPractise,
  submitLabel,
  submitting,
  serverError,
  onSubmit,
}: Props) {
  const { control, handleSubmit, formState, setValue } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      phone: initial?.phone ?? '',
      email: initial?.email ?? '',
      addressLine1: initial?.address_line1 ?? '',
      addressLine2: initial?.address_line2 ?? '',
      locality: initial?.locality ?? '',
      city: initial?.city ?? '',
      state: initial?.state ?? '',
      postalCode: initial?.postal_code ?? '',
      emergencyServices: initial?.emergency_services ?? false,
      practisesHere: false,
    },
  });
  const e = formState.errors;
  const state = useWatch({ control, name: 'state' });
  const submit = handleSubmit((v) => onSubmit(toClinicPayload(v, !initial && canPractise)));

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
          testID={`clinic-${name}`}
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

  const toggle = (name: 'emergencyServices' | 'practisesHere', label: string, hint: string) => (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => (
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text variant="bodyStrong">{label}</Text>
            <Text variant="caption" color="textMuted">
              {hint}
            </Text>
          </View>
          <Switch
            value={value}
            onValueChange={onChange}
            accessibilityLabel={label}
            trackColor={{ true: colors.primarySoft, false: colors.border }}
            thumbColor={value ? colors.primary : colors.surface}
          />
        </View>
      )}
    />
  );

  return (
    <View style={styles.form}>
      <FormSection title="Clinic details" note="Shown to pet parents after verification.">
        {field('name', 'Clinic name', { autoCapitalize: 'words', maxLength: 120 })}
        <View style={styles.row}>
          <View style={styles.flex}>
            {field('phone', 'Phone', { keyboardType: 'phone-pad', placeholder: '044 2345 6789' })}
          </View>
        </View>
        {field('email', 'Email (optional)', {
          keyboardType: 'email-address',
          autoCapitalize: 'none',
        })}
        {toggle('emergencyServices', 'Emergency services', 'You accept urgent cases.')}
      </FormSection>

      <FormSection title="Address" note="A map pin arrives with the discovery map.">
        {field('addressLine1', 'Street address', { autoCapitalize: 'words' })}
        {field('addressLine2', 'Building / floor (optional)')}
        {field('locality', 'Area / locality', {
          autoCapitalize: 'words',
          placeholder: 'e.g. Adyar',
        })}
        <View style={styles.row}>
          <View style={styles.flex}>{field('city', 'City', { autoCapitalize: 'words' })}</View>
          <View style={styles.pin}>
            {field('postalCode', 'PIN code', { keyboardType: 'number-pad', maxLength: 6 })}
          </View>
        </View>
        <ChipGroup
          label="State"
          options={STATES}
          selected={[state]}
          onToggle={(s) => setValue('state', s, { shouldValidate: true })}
        />
        {!STATES.includes(state) ? field('state', 'Other state') : null}
      </FormSection>

      {!initial && canPractise ? (
        <FormSection title="Your role">
          {toggle('practisesHere', 'I practise here', 'List me as a vet at this clinic.')}
        </FormSection>
      ) : null}

      {serverError ? (
        <Text variant="body" color="error" accessibilityRole="alert">
          {serverError}
        </Text>
      ) : null}
      <Button
        testID="clinic-submit"
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
  flex: { flex: 1, gap: spacing.xxs },
  pin: { width: 120 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
