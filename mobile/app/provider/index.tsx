import { router, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { ErrorState, Skeleton } from '@/components/states/StateViews';
import {
  ActionCard,
  Card,
  HeroScreen,
  ListRow,
  SectionHeader,
  StatusPill,
  Text,
} from '@/components/ui';
import { useMyClinics, useProviderProfiles } from '@/features/providers/hooks';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { PROVIDER_LABEL, STATUS_INFO } from '@/features/providers/labels';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, spacing } from '@/theme';

const STEPS = [
  { n: '1', title: 'Create your profile', text: 'Your details, experience and languages.' },
  {
    n: '2',
    title: 'Upload documents',
    text: 'ID and registration. Kept private; only our team sees them.',
  },
  {
    n: '3',
    title: 'Get verified',
    text: 'We review and add a verified badge when everything checks out.',
  },
];

export default function ProviderHubScreen() {
  const profiles = useProviderProfiles();
  const clinics = useMyClinics();
  useRefreshOnFocus(profiles.refetch, clinics.refetch);
  const loading = profiles.isPending || clinics.isPending;
  const error = profiles.error ?? clinics.error;
  const vet = profiles.data?.find((p) => p.provider_type === 'veterinarian');
  const caretaker = profiles.data?.find((p) => p.provider_type === 'caretaker');
  const operated = clinics.data?.filter((c) => c.my_roles.includes('operator')) ?? [];
  const hasAnything = !!profiles.data?.length || operated.length > 0;

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="provider-hub"
        underHeader
        eyebrow="For professionals"
        title="Grow with Petfinity"
        subtitle="Reach pet parents nearby with a verified profile and simple booking tools."
        // Overlap only when the first element is a card (never a bare heading).
        overlap={loading || !!error || hasAnything}
      >
        {loading ? (
          <Card style={styles.loading}>
            <Skeleton height={56} />
            <Skeleton height={56} />
          </Card>
        ) : error ? (
          <Card>
            <ErrorState
              onRetry={() => {
                void profiles.refetch();
                void clinics.refetch();
              }}
              requestId={isApiError(error) ? error.requestId : null}
            />
          </Card>
        ) : (
          <>
            {hasAnything ? (
              <Card style={styles.card}>
                <SectionHeader title="Your profiles" />
                {[vet, caretaker]
                  .filter((p) => !!p)
                  .map((p) => (
                    <ListRow
                      key={p.id}
                      testID={`provider-profile-${p.provider_type}`}
                      icon={p.provider_type === 'veterinarian' ? 'medkit' : 'home'}
                      tone={p.provider_type === 'veterinarian' ? 'lavender' : 'peach'}
                      title={PROVIDER_LABEL[p.provider_type]}
                      subtitle={p.display_name}
                      trailing={
                        <StatusPill
                          label={STATUS_INFO[p.verification_status].label}
                          tone={STATUS_INFO[p.verification_status].tone}
                        />
                      }
                      onPress={() =>
                        router.push(
                          p.provider_type === 'veterinarian'
                            ? `/provider/manage/provider_profile/${p.id}`
                            : `/provider/verify/provider_profile/${p.id}`,
                        )
                      }
                    />
                  ))}
                {operated.map((c) => (
                  <ListRow
                    key={c.id}
                    testID={`provider-clinic-${c.id}`}
                    icon="business"
                    tone="sage"
                    title={c.name}
                    subtitle={`Clinic · ${c.city}`}
                    trailing={
                      <StatusPill
                        label={STATUS_INFO[c.verification_status].label}
                        tone={STATUS_INFO[c.verification_status].tone}
                      />
                    }
                    onPress={() => router.push(`/provider/manage/clinic/${c.id}`)}
                  />
                ))}
              </Card>
            ) : null}

            <View style={styles.section}>
              <SectionHeader title={hasAnything ? 'Add another' : 'How would you like to join?'} />
              <View style={styles.row}>
                {!vet ? (
                  <ActionCard
                    testID="start-veterinarian"
                    icon="medkit"
                    tone="lavender"
                    gradient="lavender"
                    title="Veterinarian"
                    subtitle="Offer consultations and visits"
                    onPress={() =>
                      router.push({
                        pathname: '/provider/profile/new',
                        params: { type: 'veterinarian' },
                      })
                    }
                  />
                ) : null}
                {!caretaker ? (
                  <ActionCard
                    testID="start-caretaker"
                    icon="home"
                    tone="peach"
                    gradient="coral"
                    title="Caretaker"
                    subtitle="Sitting, day care, boarding"
                    onPress={() =>
                      router.push({
                        pathname: '/provider/profile/new',
                        params: { type: 'caretaker' },
                      })
                    }
                  />
                ) : null}
              </View>
              <View style={styles.row}>
                <ActionCard
                  testID="start-clinic"
                  icon="business"
                  tone="sage"
                  gradient="sage"
                  title="Clinic"
                  subtitle="List your clinic and team"
                  onPress={() => router.push('/provider/clinic/new')}
                />
                {vet && caretaker ? <View style={styles.spacer} /> : null}
              </View>
            </View>

            <Card style={styles.card}>
              <SectionHeader title="How verification works" />
              {STEPS.map((s) => (
                <View key={s.n} style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text variant="label" color="textOnPrimary">
                      {s.n}
                    </Text>
                  </View>
                  <View style={styles.stepText}>
                    <Text variant="bodyStrong">{s.title}</Text>
                    <Text variant="caption" color="textMuted">
                      {s.text}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        )}
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { gap: spacing.md },
  card: { gap: spacing.sm },
  section: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  spacer: { flex: 1 },
  step: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, gap: spacing.xxs },
});
