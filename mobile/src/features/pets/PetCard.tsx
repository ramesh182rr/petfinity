import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

import { petSubtitle } from './format';
import { PetAvatar } from './PetAvatar';
import type { Pet } from './types';

export function PetCard({ pet, onPress }: { pet: Pet; onPress: () => void }) {
  const subtitle = petSubtitle(pet);
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${pet.name}, ${subtitle}`}
      accessibilityHint="Opens this pet's profile"
      testID={`pet-card-${pet.id}`}
    >
      <View style={styles.row}>
        <PetAvatar pet={pet} />
        <View style={styles.text}>
          <Text variant="subheading" numberOfLines={1}>
            {pet.name}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: spacing.xxs },
});
