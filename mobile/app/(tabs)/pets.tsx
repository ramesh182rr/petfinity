import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/states/StateViews';
import { Button, Card, Text } from '@/components/ui';
import { usePets } from '@/features/pets/hooks';
import { PetCard } from '@/features/pets/PetCard';
import { colors, spacing } from '@/theme';

export default function PetsScreen() {
  const { data: pets, isPending, isError, error, refetch, isRefetching } = usePets();

  return (
    <SafeAreaView edges={['top']} style={styles.safe} testID="pets-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.header}>
          <Text variant="title">My Pets</Text>
          {pets?.length ? (
            <Button
              label="Add pet"
              icon="add"
              variant="secondary"
              onPress={() => router.push('/pets/new')}
              testID="add-pet"
            />
          ) : null}
        </View>

        {isPending ? (
          <View style={styles.list} accessibilityLabel="Loading your pets">
            {[0, 1].map((i) => (
              <Card key={i}>
                <View style={styles.skeletonRow}>
                  <Skeleton width={56} height={56} rounded />
                  <View style={styles.skeletonText}>
                    <Skeleton width="50%" height={18} />
                    <Skeleton width="70%" height={14} />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            onRetry={() => void refetch()}
            requestId={isApiError(error) ? error.requestId : null}
          />
        ) : pets.length === 0 ? (
          <EmptyState
            icon="paw-outline"
            tone="peach"
            title="Every pet, one place"
            message="Create a profile for each of your pets — dogs, cats and every other companion — with their care notes and health details."
            action={{ label: 'Add your first pet', onPress: () => router.push('/pets/new') }}
          />
        ) : (
          <View style={styles.list}>
            {pets.map((pet) => (
              <PetCard key={pet.id} pet={pet} onPress={() => router.push(`/pets/${pet.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  list: { gap: spacing.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  skeletonText: { flex: 1, gap: spacing.sm },
});
