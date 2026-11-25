import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import {
  ChipGroup,
  Button,
  FormSection,
  Screen,
  SegmentedControl,
  Text,
  TextField,
} from '@/components/ui';
import { LoadingState } from '@/components/states/StateViews';
import { errorMessage } from '@/features/auth/errorMessage';
import { CATEGORIES, CATEGORY_LABEL, formatDuration, parseRupees } from '@/features/catalog/format';
import { useArchiveService, useSaveService, useServices } from '@/features/catalog/hooks';
import { backToWorkspace } from '@/features/catalog/navigation';
import type {
  ConfirmationMode,
  OwnerType,
  Service,
  ServiceCategory,
  ServiceMode,
} from '@/features/catalog/types';
import { colors, spacing } from '@/theme';

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];
const SPECIES = [
  { value: 'dog', label: 'Dogs' },
  { value: 'cat', label: 'Cats' },
  { value: 'other', label: 'Other pets' },
] as const;

function ServiceForm({
  ownerType,
  ownerId,
  initial,
}: {
  ownerType: OwnerType;
  ownerId: string;
  initial?: Service;
}) {
  const isClinic = ownerType === 'clinic';
  const save = useSaveService(ownerType, ownerId, initial?.id);
  const archive = useArchiveService(ownerType, ownerId);
  const [category, setCategory] = useState<ServiceCategory>(
    initial?.category ?? 'general_consultation',
  );
  const [title, setTitle] = useState(initial?.title ?? CATEGORY_LABEL.general_consultation);
  const [titleTouched, setTitleTouched] = useState(!!initial);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price_minor / 100) : '');
  const [duration, setDuration] = useState(initial?.duration_minutes ?? 30);
  const [mode, setMode] = useState<ServiceMode>(
    initial?.service_mode ?? (isClinic ? 'in_clinic' : 'home_visit'),
  );
  const [confirmation, setConfirmation] = useState<ConfirmationMode>(
    initial?.confirmation_mode ?? (mode === 'home_visit' ? 'request' : 'instant'),
  );
  const [species, setSpecies] = useState<string[]>(initial?.species ?? ['dog', 'cat']);
  const [active, setActive] = useState(initial?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickCategory = (value: string) => {
    const next = CATEGORIES.find((c) => c.label === value)?.value ?? category;
    setCategory(next);
    if (!titleTouched) setTitle(CATEGORY_LABEL[next]);
  };
  const pickMode = (next: ServiceMode) => {
    setMode(next);
    if (!initial) setConfirmation(next === 'home_visit' ? 'request' : 'instant');
  };

  const submit = () => {
    const priceMinor = parseRupees(price);
    const next: Record<string, string> = {};
    if (title.trim().length < 2) next.title = 'Give the service a name.';
    if (priceMinor === null) next.price = 'Enter a price like 500 or 499.50.';
    if (!species.length) next.species = 'Choose at least one.';
    setErrors(next);
    if (Object.keys(next).length || priceMinor === null) return;
    save.mutate(
      {
        category,
        title: title.trim(),
        description: description.trim() || null,
        price_minor: priceMinor,
        duration_minutes: duration,
        service_mode: mode,
        confirmation_mode: confirmation,
        species: species as Service['species'],
        active,
      },
      { onSuccess: () => backToWorkspace(ownerType, ownerId) },
    );
  };

  return (
    <View style={styles.form}>
      <FormSection title="What you offer">
        <ChipGroup
          label="Category"
          options={CATEGORIES.map((c) => c.label)}
          selected={[CATEGORY_LABEL[category]]}
          onToggle={pickCategory}
        />
        <TextField
          testID="service-title"
          label="Name shown to pet parents"
          value={title}
          maxLength={80}
          onChangeText={(v) => {
            setTitle(v);
            setTitleTouched(true);
          }}
          error={errors.title}
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={500}
          placeholder="What's included"
        />
      </FormSection>

      <FormSection title="Price & time">
        <TextField
          testID="service-price"
          label="Price"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          prefix={<Text variant="bodyStrong">₹</Text>}
          placeholder="500"
          error={errors.price}
        />
        <ChipGroup
          label="Duration"
          options={DURATIONS.map(formatDuration)}
          selected={[formatDuration(duration)]}
          onToggle={(label) =>
            setDuration(DURATIONS.find((d) => formatDuration(d) === label) ?? duration)
          }
        />
      </FormSection>

      <FormSection
        title="How it's booked"
        note={
          confirmation === 'instant'
            ? 'Instant: pet parents get a confirmed appointment straight away. Keep your hours up to date.'
            : 'On request: you confirm each booking within 2 hours, or it expires and the slot is freed.'
        }
      >
        {isClinic ? (
          <SegmentedControl
            accessibilityLabel="Where"
            value={mode}
            onChange={pickMode}
            options={[
              { value: 'in_clinic', label: 'Clinic visit' },
              { value: 'home_visit', label: 'Home visit' },
            ]}
          />
        ) : (
          <Text variant="body" color="textMuted">
            Independent vets offer home visits. Clinic visits are listed through a clinic.
          </Text>
        )}
        <SegmentedControl
          accessibilityLabel="Confirmation"
          value={confirmation}
          onChange={setConfirmation}
          options={[
            { value: 'instant', label: 'Instant' },
            { value: 'request', label: 'On request' },
          ]}
        />
        <ChipGroup
          label="Pets you see"
          options={SPECIES.map((s) => s.label)}
          selected={SPECIES.filter((s) => species.includes(s.value)).map((s) => s.label)}
          onToggle={(label) => {
            const value = SPECIES.find((s) => s.label === label)?.value;
            if (value)
              setSpecies((cur) =>
                cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
              );
          }}
        />
        {errors.species ? (
          <Text variant="caption" color="error">
            {errors.species}
          </Text>
        ) : null}
        {initial ? (
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">Bookable</Text>
              <Text variant="caption" color="textMuted">
                Pause to hide it without deleting.
              </Text>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              accessibilityLabel="Bookable"
              trackColor={{ true: colors.primarySoft, false: colors.border }}
              thumbColor={active ? colors.primary : colors.surface}
            />
          </View>
        ) : null}
      </FormSection>

      {save.isError ? (
        <Text variant="body" color="error" accessibilityRole="alert">
          {errorMessage(save.error)}
        </Text>
      ) : null}
      <Button
        testID="service-save"
        label={initial ? 'Save changes' : 'Add service'}
        size="lg"
        fullWidth
        loading={save.isPending}
        onPress={submit}
      />
      {initial ? (
        <Button
          label="Remove service"
          variant="tertiary"
          fullWidth
          loading={archive.isPending}
          onPress={() =>
            Alert.alert(
              `Remove “${initial.title}”?`,
              'It will no longer be bookable. Past bookings keep their details.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () =>
                    archive.mutate(initial.id, {
                      onSuccess: () => backToWorkspace(ownerType, ownerId),
                    }),
                },
              ],
            )
          }
        />
      ) : null}
    </View>
  );
}

export default function ServiceScreen() {
  const params = useLocalSearchParams<{ ownerType: string; id: string; serviceId?: string }>();
  const ownerType: OwnerType = params.ownerType === 'clinic' ? 'clinic' : 'provider_profile';
  const services = useServices(ownerType, params.id);
  if (params.serviceId && services.isPending) return <LoadingState message="Loading service…" />;
  const initial = params.serviceId
    ? services.data?.find((s) => s.id === params.serviceId)
    : undefined;
  return (
    <Screen edges={[]} testID="service-screen">
      <ServiceForm
        key={initial?.id ?? 'new'}
        ownerType={ownerType}
        ownerId={params.id}
        initial={initial}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
});
