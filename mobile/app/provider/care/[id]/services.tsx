import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import { Button, Card, ChipGroup, IconBadge, Screen, Text, TextField } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { CARE_TYPES, SPECIES_LABEL } from '@/features/care/format';
import { initialDrafts, SPECIES, toCareServices, type Draft } from '@/features/care/drafts';
import { useCare, useSaveCareServices } from '@/features/care/hooks';
import type { CareService, CareType } from '@/features/care/types';
import { colors, spacing } from '@/theme';

function Editor({ id, services }: { id: string; services: CareService[] }) {
  const save = useSaveCareServices(id);
  const [drafts, setDrafts] = useState(() => initialDrafts(services));
  const [errors, setErrors] = useState<Partial<Record<CareType, string>>>({});
  const update = (type: CareType, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [type]: { ...d[type], ...patch } }));

  const submit = () => {
    const result = toCareServices(drafts);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    save.mutate(result.services, { onSuccess: () => router.back() });
  };

  return (
    <Screen edges={[]} testID="care-services">
      <Text variant="body" color="textMuted">
        Choose what you offer and a starting rate. Each request is still priced in your offer, so
        you can adjust for the pet, dates and distance.
      </Text>
      {CARE_TYPES.map((t) => {
        const d = drafts[t.value];
        return (
          <Card key={t.value} style={styles.card} testID={`care-type-${t.value}`}>
            <View style={styles.head}>
              <IconBadge name={t.icon} tone={t.tone} />
              <View style={styles.flex}>
                <Text variant="subheading">{t.label}</Text>
                <Text variant="caption" color="textMuted">
                  {t.where}
                </Text>
              </View>
              <Switch
                value={d.on}
                onValueChange={(on) => update(t.value, { on })}
                accessibilityLabel={`Offer ${t.label}`}
                trackColor={{ true: colors.primarySoft, false: colors.border }}
                thumbColor={d.on ? colors.primary : colors.surface}
                testID={`care-toggle-${t.value}`}
              />
            </View>
            {d.on ? (
              <View style={styles.body}>
                <TextField
                  label={`Starting rate per ${t.unit}`}
                  value={d.rate}
                  onChangeText={(rate) => update(t.value, { rate })}
                  keyboardType="number-pad"
                  maxLength={6}
                  prefix={<Text variant="bodyStrong">₹</Text>}
                  error={errors[t.value]}
                  testID={`care-rate-${t.value}`}
                />
                <ChipGroup
                  label="Pets you take"
                  options={SPECIES.map((s) => SPECIES_LABEL[s] ?? s)}
                  selected={d.species.map((s) => SPECIES_LABEL[s] ?? s)}
                  onToggle={(label) => {
                    const key = SPECIES.find((s) => SPECIES_LABEL[s] === label) ?? 'other';
                    update(t.value, {
                      species: d.species.includes(key)
                        ? d.species.filter((s) => s !== key)
                        : [...d.species, key],
                    });
                  }}
                />
                <ChipGroup
                  label="Pets in one booking"
                  options={['1', '2', '3', '4', '5']}
                  selected={[String(d.maxPets)]}
                  onToggle={(n) => update(t.value, { maxPets: Number(n) })}
                />
              </View>
            ) : null}
          </Card>
        );
      })}
      {save.isError ? (
        <Text variant="body" color="error" accessibilityRole="alert">
          {errorMessage(save.error)}
        </Text>
      ) : null}
      <Button
        label="Save services"
        size="lg"
        fullWidth
        loading={save.isPending}
        onPress={submit}
        testID="care-save"
      />
    </Screen>
  );
}

export default function CareServicesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const care = useCare(id);
  if (care.isPending) return <LoadingState message="Loading services…" />;
  if (care.isError) {
    return (
      <ErrorState
        onRetry={() => void care.refetch()}
        requestId={isApiError(care.error) ? care.error.requestId : null}
      />
    );
  }
  return <Editor id={id} services={care.data.services} />;
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
  body: { gap: spacing.md },
});
