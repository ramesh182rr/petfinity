import { StyleSheet, View, type ViewStyle } from 'react-native';

type Bubble = { size: number; color: string; opacity?: number } & Pick<
  ViewStyle,
  'top' | 'left' | 'right' | 'bottom'
>;

/** Soft decorative circles in the moodboard style. Purely visual; hidden from screen readers. */
export function Decor({ bubbles }: { bubbles: Bubble[] }) {
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {bubbles.map(({ size, color, opacity = 0.18, ...position }, i) => (
        <View
          key={i}
          style={[
            styles.bubble,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity },
            position,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ bubble: { position: 'absolute' } });
