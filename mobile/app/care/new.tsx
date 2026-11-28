import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState, LoadingState } from '@/components/states/StateViews';
import {
  Button,
  Card,
  ChipGroup,
  DateField,
  FormSection,
  IconBadge,
  Screen,
  Text,
  TextField,
  TimeField,
} from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { CARE_TYPES, PARENT_WHERE } from '@/features/care/format';
import { useCreateCareRequest } from '@/features/care/hooks';
import {
  buildRequest,
  defaultsFor,
  estimateUnits,
  type CareForm,
} from '@/features/care/requestForm';
import type { CareType } from '@/features/care/types';
import { LocationField } from '@/features/discovery/LocationField';
import { useDiscoveryStore } from '@/features/discovery/store';
import type { AreaKey } from '@/features/discovery/types';
import { usePets } from '@/features/pets/hooks';
import { PetAvatar } from '@/features/pets/PetAvatar';
import { colors, radius, spacing } from '@/theme';

/** Parent: post a care request to nearby verified caretakers (3.4, decision 0015). */
export default function NewCareRequestScreen() {
  const pets = usePets();
  const origin = useDiscoveryStore((s) => s.origin);
  const create = useCreateCareRequest();
  const [form, setForm] = useState<CareForm>(() => ({
    ...defaultsFor('boarding'),
    petIds: [],
    areaKey: origin?.type === 'area' ? origin.key : null,
    latitude: null,
    longitude: null,
    locality: '',
    address: '',
    notes: '',
    budget: '',
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<CareForm>) => setForm((f) => ({ ...f, ...patch }));
  const type = CARE_TYPES.find((t) => t.value === form.careType) ?? CARE_TYPES[0]!;
  const units = useMemo(() => estimateUnits(form), [form]);
  const needsAddress = form.careType === 'home_visit' || form.careType === 'house_sitting';

  if (pets.isPending) return <LoadingState message="Loading your pets…" />;
  if (!pets.data?.length) {
    return (
      <EmptyState
        icon="paw"
        tone="lavender"
        title="Add your pet first"
        message="Caretakers need to know who they're looking after."
        action={{ label: 'Add a pet', onPress: () => router.push('/pets/new') }}
      />
    );
  }

  const submit = () => {
    const result = buildRequest(form);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    create.mutate(result.body, {
      onSuccess: (r) => router.replace({ pathname: '/care/[id]', params: { id: r.id } }),
    });
  };

  return (
    <Screen edges={[]} testID="care-new">
      <FormSection title="What kind of care?">
        <View style={styles.types}>
          {CARE_TYPES.map((t) => {
            const selected = t.value === form.careType;
            return (
              <Pressable
                key={t.value}
                onPress={() => set(defaultsFor(t.value as CareType))}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${t.label}. ${PARENT_WHERE[t.value]}`}
                style={[styles.type, selected && styles.typeSelected]}
                testID={`care-pick-${t.value}`}
              >
                <IconBadge name={t.icon} tone={t.tone} />
                <View style={styles.flex}>
                  <Text variant="bodyStrong">{t.label}</Text>
                  <Text variant="caption" color="textMuted" numberOfLines={2}>
                    {PARENT_WHERE[t.value]}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={22}
                  color={selected ? colors.primary : colors.borderStrong}
                />
              </Pressable>
            );
          })}
        </View>
      </FormSection>

      <FormSection title="Who is it for?" note="Up to 5 pets in one request.">
        <View style={styles.pets}>
          {pets.data.map((p) => {
            const selected = form.petIds.includes(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() =>
                  set({
                    petIds: selected
                      ? form.petIds.filter((x) => x !== p.id)
                      : [...form.petIds, p.id],
                  })
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={p.name}
                style={[styles.pet, selected && styles.petSelected]}
                testID={`care-pet-${p.id}`}
              >
                <PetAvatar pet={p} size={36} />
                <Text variant="label" color={selected ? 'primary' : 'text'}>
                  {p.name}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {errors.pets ? (
          <Text variant="caption" color="error">
            {errors.pets}
          </Text>
        ) : null}
      </FormSection>

      <FormSection title="When?" note={units ? `That's ${units}.` : undefined}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <DateField
              label={
                form.careType === 'boarding' || form.careType === 'house_sitting'
                  ? 'From'
                  : 'First day'
              }
              value={form.startDate}
              onChange={(d) => set({ startDate: d, endDate: d > form.endDate ? d : form.endDate })}
              minimumDate={new Date()}
              testID="care-start-date"
            />
          </View>
          <TimeField
            label="Start time"
            value={form.startTime}
            onChange={(v) => set({ startTime: v })}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <DateField
              label={
                form.careType === 'boarding' || form.careType === 'house_sitting'
                  ? 'Until'
                  : 'Last day'
              }
              value={form.endDate}
              onChange={(d) => set({ endDate: d })}
              minimumDate={form.startDate}
              testID="care-end-date"
            />
          </View>
          <TimeField label="End time" value={form.endTime} onChange={(v) => set({ endTime: v })} />
        </View>
        {form.careType === 'home_visit' ? (
          <ChipGroup
            label="Visits a day"
            options={['1', '2', '3']}
            selected={[String(form.visitsPerDay)]}
            onToggle={(n) => set({ visitsPerDay: Number(n) })}
            testID="care-visits"
          />
        ) : null}
        {errors.dates ? (
          <Text variant="caption" color="error">
            {errors.dates}
          </Text>
        ) : null}
      </FormSection>

      <FormSection
        title="Where?"
        note="Caretakers see only your area and locality. Your pin and address are shared with the one you book."
      >
        <LocationField
          value={{
            areaKey: form.areaKey as AreaKey | null,
            latitude: form.latitude,
            longitude: form.longitude,
          }}
          onChange={(v) =>
            set({ areaKey: v.areaKey, latitude: v.latitude, longitude: v.longitude })
          }
          pinHint="Pin your home so nearby caretakers can find your request."
          testID="care-location"
        />
        {errors.area ? (
          <Text variant="caption" color="error">
            {errors.area}
          </Text>
        ) : null}
        <TextField
          label="Locality"
          value={form.locality}
          onChangeText={(locality) => set({ locality })}
          placeholder="e.g. Adyar"
          error={errors.locality}
          testID="care-locality"
        />
        {needsAddress ? (
          <TextField
            label="Full address"
            value={form.address}
            onChangeText={(address) => set({ address })}
            multiline
            maxLength={300}
            placeholder="House / flat, street"
            error={errors.address}
            testID="care-address"
          />
        ) : null}
      </FormSection>

      <FormSection title="Anything they should know?">
        <TextField
          label="Notes (optional)"
          value={form.notes}
          onChangeText={(notes) => set({ notes })}
          multiline
          maxLength={1000}
          placeholder="Routine, food, walks, medicines, how they get on with other pets"
          testID="care-notes"
        />
        <TextField
          label="Your budget for the whole request (optional)"
          value={form.budget}
          onChangeText={(budget) => set({ budget: budget.replace(/[^0-9]/g, '') })}
          keyboardType="number-pad"
          maxLength={7}
          prefix={<Text variant="bodyStrong">₹</Text>}
          error={errors.budget}
          testID="care-budget"
        />
      </FormSection>

      <Card style={styles.summary}>
        <IconBadge name="people" tone="sage" />
        <View style={styles.flex}>
          <Text variant="bodyStrong">Verified caretakers nearby will send offers</Text>
          <Text variant="caption" color="textMuted">
            Offers arrive within 24 hours (up to 5). Compare and pick one; nothing is charged until
            you book.{' '}
            {type.label === 'House sitting' || type.label === 'Boarding'
              ? 'A meet-and-greet first is a great idea.'
              : ''}
          </Text>
        </View>
      </Card>
      {create.isError ? (
        <Text variant="body" color="error" accessibilityRole="alert" testID="care-error">
          {errorMessage(create.error)}
        </Text>
      ) : null}
      <Button
        label="Post request"
        icon="paper-plane"
        size="lg"
        fullWidth
        loading={create.isPending}
        onPress={submit}
        testID="care-submit"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xxs },
  types: { gap: spacing.sm },
  type: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeSelected: { borderColor: colors.primary, borderWidth: 2 },
  pets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.xs,
    paddingRight: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  petSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  summary: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
});
