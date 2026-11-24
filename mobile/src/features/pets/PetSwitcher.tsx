import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Skeleton } from '@/components/states/StateViews';
import { Card, Text } from '@/components/ui';
import { colors, radius, spacing, touchTarget } from '@/theme';

import { resolveActivePet, useActivePetStore } from './activePet';
import { usePets } from './hooks';
import { PetAvatar } from './PetAvatar';

/** Home "pet selector" (doc 09): pick the pet you're acting for, or add one. */
export function PetSwitcher() {
  const { data: pets, isPending, isError } = usePets();
  const activePetId = useActivePetStore((s) => s.activePetId);
  const setActivePet = useActivePetStore((s) => s.setActivePet);
  const active = resolveActivePet(pets, activePetId);

  if (isError) return null; // Home stays usable; My Pets shows the full error state.

  return (
    <View style={styles.section} testID="pet-switcher">
      <Text variant="subheading">Your pets</Text>
      {isPending ? (
        <View style={styles.row}>
          <Skeleton width={120} height={56} rounded />
          <Skeleton width={120} height={56} rounded />
        </View>
      ) : !pets.length ? (
        <Card
          onPress={() => router.push('/pets/new')}
          accessibilityLabel="Add your first pet"
          tone="surfaceTint"
        >
          <View style={styles.emptyRow}>
            <Ionicons name="add-circle" size={32} color={colors.primary} />
            <View style={styles.emptyText}>
              <Text variant="bodyStrong">Add your first pet</Text>
              <Text variant="caption" color="textMuted">
                It only takes a minute, and makes booking care faster.
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {pets.map((pet) => {
            const selected = pet.id === active?.id;
            return (
              <Pressable
                key={pet.id}
                onPress={() => setActivePet(pet.id)}
                onLongPress={() => router.push(`/pets/${pet.id}`)}
                accessibilityRole="button"
                accessibilityLabel={pet.name}
                accessibilityState={{ selected }}
                accessibilityHint="Selects this pet. Long press to open the profile."
                style={[styles.pill, selected && styles.pillSelected]}
              >
                <PetAvatar pet={pet} size={40} />
                <Text variant="label" color={selected ? 'primary' : 'text'}>
                  {pet.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push('/pets/new')}
            accessibilityRole="button"
            accessibilityLabel="Add a pet"
            style={[styles.pill, styles.addPill]}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, paddingRight: spacing.lg },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget + 8,
    paddingLeft: spacing.xs,
    paddingRight: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  pillSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  addPill: { paddingHorizontal: spacing.lg, justifyContent: 'center' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emptyText: { flex: 1, gap: spacing.xxs },
});
