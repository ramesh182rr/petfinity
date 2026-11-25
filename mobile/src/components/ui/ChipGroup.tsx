import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Chip } from './Chip';
import { Text } from './Text';

type Props = {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  testID?: string;
};

/** Labelled set of selectable chips (single or multi-select, decided by the caller). */
export function ChipGroup({ label, options, selected, onToggle, testID }: Props) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Text variant="label">{label}</Text>
      <View style={styles.chips} accessibilityLabel={label}>
        {options.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={selected.includes(option)}
            onPress={() => onToggle(option)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
