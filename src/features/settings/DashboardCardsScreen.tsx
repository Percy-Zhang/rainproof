import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import {
  getDashboardCardDefinition,
  normalizeDashboardCardSettings,
  toggleDashboardCardSetting,
} from '../../domain/dashboardCards';
import type { DashboardCardId, DashboardCardSetting } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type DashboardCardsScreenProps = {
  settings: DashboardCardSetting[] | null | undefined;
  onUpdateSettings: (settings: DashboardCardSetting[]) => Promise<void>;
};

export function DashboardCardsScreen({
  settings,
  onUpdateSettings,
}: DashboardCardsScreenProps) {
  const [draftSettings, setDraftSettings] = useState(() => normalizeDashboardCardSettings(settings));

  useEffect(() => {
    setDraftSettings(normalizeDashboardCardSettings(settings));
  }, [settings]);

  async function commit(nextSettings: DashboardCardSetting[]) {
    setDraftSettings(nextSettings);
    await onUpdateSettings(nextSettings);
  }

  function toggleCard(id: DashboardCardId) {
    void commit(toggleDashboardCardSetting(draftSettings, id));
  }

  const visibleCount = draftSettings.filter((setting) => setting.visible).length;

  function renderCardRow({ item, drag, isActive }: RenderItemParams<DashboardCardSetting>) {
    const definition = getDashboardCardDefinition(item.id);
    const disableToggle = item.visible && visibleCount <= 1;

    return (
      <ScaleDecorator>
        <View style={[styles.cardRow, isActive && styles.draggingRow]}>
          <Pressable
            accessibilityLabel={`Reorder ${definition.title}`}
            accessibilityRole="button"
            onLongPress={drag}
            style={({ pressed }) => [styles.dragHandle, pressed && styles.pressed]}
            testID={`dashboard-card-drag-${item.id}`}
          >
            <Ionicons name="reorder-three-outline" size={24} color={colors.primaryDark} />
          </Pressable>

          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>{definition.title}</Text>
            <Text style={styles.rowDetail}>{getDashboardCardDescription(item.id)}</Text>
          </View>

          <Switch
            value={item.visible}
            onValueChange={() => toggleCard(item.id)}
            disabled={disableToggle}
            trackColor={{ false: colors.faint, true: colors.accent }}
            thumbColor={item.visible ? colors.primaryDark : colors.surface}
          />
        </View>
      </ScaleDecorator>
    );
  }

  return (
    <View style={styles.stack}>
      <DraggableFlatList
        data={draftSettings}
        keyExtractor={(setting) => setting.id}
        onDragEnd={({ data }) => {
          void commit(data);
        }}
        renderItem={renderCardRow}
        activationDistance={8}
        containerStyle={styles.draggableList}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <Text style={styles.note}>Choose which Dashboard cards appear and drag rows to reorder them.</Text>
        )}
      />
    </View>
  );
}

function getDashboardCardDescription(id: DashboardCardId): string {
  switch (id) {
    case 'balanceSummary':
      return 'Totals grouped by currency.';
    case 'cashFlow':
      return 'Income, spending, and net cash flow for this month.';
    case 'rainyDay':
      return 'Rainy day fund progress and goal.';
    case 'accounts':
      return 'Dashboard account balances and account filter chips.';
    case 'creditCards':
      return 'Owed, available credit, and utilization when credit cards exist.';
    case 'budgetProgress':
      return 'Monthly budget progress when active budgets exist.';
    case 'topSpending':
      return 'Largest spending categories for this month.';
    case 'recentTransactions':
      return 'Latest transactions from selected dashboard accounts.';
  }
}

const styles = StyleSheet.create({
  cardRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 82,
    padding: spacing.md,
  },
  dragHandle: {
    alignItems: 'center',
    borderRadius: 8,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  draggableList: {
    flex: 1,
  },
  draggingRow: {
    elevation: 8,
    opacity: 0.95,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  listContent: {
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  note: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
  },
  pressed: {
    opacity: 0.78,
  },
  rowDetail: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  stack: {
    flex: 1,
  },
});
