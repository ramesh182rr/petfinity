import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, elevation, gradients, radius, spacing } from '@/theme';

import { ageLabel, speciesIcon, speciesLabel } from './format';
import { PetAvatar } from './PetAvatar';
import type { Pet } from './types';

const TINT = {
  lavender: gradients.lavender,
  sage: gradients.sage,
  coral: gradients.coral,
  peach: gradients.warm,
} as const;

/** Grid card: tinted background by species, ringed avatar, name and details. */
export function PetCard({ pet, onPress }: { pet: Pet; onPress: () => void }) {
  const species = speciesLabel(pet);
  const age = ageLabel(pet);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[pet.name, species, pet.breed, age].filter(Boolean).join(', ')}
      accessibilityHint="Opens this pet's profile"
      testID={`pet-card-${pet.id}`}
      style={({ pressed }) => [styles.outer, pressed && styles.pressed]}
    >
      <LinearGradient colors={TINT[speciesIcon(pet.species).tone]} style={styles.card}>
        <View style={styles.ring}>
          <PetAvatar pet={pet} size={76} />
        </View>
        <Text variant="subheading" numberOfLines={1} align="center">
          {pet.name}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={1} align="center">
          {[species, pet.breed].filter(Boolean).join(' · ')}
        </Text>
        {age ? (
          <View style={styles.agePill}>
            <Text variant="label" color="primary">
              {age}
            </Text>
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, borderRadius: radius.xl, backgroundColor: colors.surface, ...elevation.card },
  pressed: { transform: [{ scale: 0.98 }] },
  card: {
    flex: 1,
    minHeight: 196,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  ring: {
    padding: 3,
    borderRadius: 999,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
    ...elevation.card,
  },
  agePill: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
