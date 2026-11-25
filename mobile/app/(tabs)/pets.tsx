import { router } from 'expo-router';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/states/StateViews';
import { Button, Card, HeroScreen } from '@/components/ui';
import { usePets } from '@/features/pets/hooks';
import { PetCard } from '@/features/pets/PetCard';
import type { Pet } from '@/features/pets/types';
import { colors, radius, spacing } from '@/theme';

function rows(pets: Pet[]): (Pet | null)[][] {
  const out: (Pet | null)[][] = [];
  for (let i = 0; i < pets.length; i += 2) out.push([pets[i] ?? null, pets[i + 1] ?? null]);
  return out;
}

export default function PetsScreen() {
  const { data: pets, isPending, isError, error, refetch, isRefetching } = usePets();
  const count = pets?.length ?? 0;

  return (
    <HeroScreen
      testID="pets-screen"
      eyebrow="My pets"
      title={count ? `${count} ${count === 1 ? 'companion' : 'companions'}` : 'Your companions'}
      subtitle="Profiles, care notes and photos, ready when you book care."
      overlap
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={colors.primary}
        />
      }
      heroContent={
        count ? (
          <Button
            label="Add pet"
            icon="add"
            variant="inverse"
            onPress={() => router.push('/pets/new')}
            testID="add-pet"
          />
        ) : null
      }
    >
      {isPending ? (
        <View style={styles.row} accessibilityLabel="Loading your pets">
          {[0, 1].map((i) => (
            <Card key={i} style={styles.skeletonCard}>
              <Skeleton width={76} height={76} rounded />
              <Skeleton width="70%" height={16} />
              <Skeleton width="50%" height={12} />
            </Card>
          ))}
        </View>
      ) : isError ? (
        <Card>
          <ErrorState
            onRetry={() => void refetch()}
            requestId={isApiError(error) ? error.requestId : null}
          />
        </Card>
      ) : count === 0 ? (
        <Card>
          <EmptyState
            icon="paw-outline"
            tone="peach"
            title="Every pet, one place"
            message="Create a profile for each of your pets — dogs, cats and every other companion — with their care notes and health details."
            action={{ label: 'Add your first pet', onPress: () => router.push('/pets/new') }}
          />
        </Card>
      ) : (
        <View style={styles.grid}>
          {rows(pets).map((pair, i) => (
            <View key={i} style={styles.row}>
              {pair.map((pet, j) =>
                pet ? (
                  <PetCard key={pet.id} pet={pet} onPress={() => router.push(`/pets/${pet.id}`)} />
                ) : (
                  <View key={`spacer-${j}`} style={styles.spacer} />
                ),
              )}
            </View>
          ))}
        </View>
      )}
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  spacer: { flex: 1 },
  skeletonCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 196,
    justifyContent: 'center',
    borderRadius: radius.xl,
  },
});
