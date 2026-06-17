import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';

export type MetadataGridItem = {
  label: string;
  value: string;
};

export function MetadataGrid({ items }: { items: MetadataGridItem[] }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={styles.item}>
          <Text style={styles.label}>{item.label}</Text>
          <Text numberOfLines={1} style={styles.value}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  item: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  label: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  value: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '800',
  },
});
