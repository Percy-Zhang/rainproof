import { Text, View } from 'react-native';

import { Card } from '../../components/ui';
import type { CategoryDefinition } from '../../domain/types';
import { statsStyles as styles } from './StatsScreenStyles';

export function StatsCategoryColorsCard({ categories }: { categories: CategoryDefinition[] }) {
  return (
    <Card testID="category-colors-card">
      <Text style={styles.cardTitle}>Category colors</Text>
      <View style={styles.categoryGrid}>
        {categories.map((category) => (
          <View key={category.id} style={styles.categoryPill}>
            <View style={[styles.swatch, { backgroundColor: category.color }]} />
            <Text style={styles.categoryPillText}>{category.name}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
