import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import { ActionButton, Card } from '../../components/ui';
import {
  getBudgetCompareHistoryPointsForBudget,
  getBudgetCurrentHistoryPointsForBudget,
  getBudgetUsageDisplayRows,
  getBudgetUsagesForPeriods,
  sortBudgetUsageDisplayRowsByDisplayOrder,
  type BudgetUsageDisplayRow,
} from '../../domain/budgets';
import { defaultCategories } from '../../domain/categories';
import type { AppSnapshot } from '../../domain/types';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  BudgetHistoryModeToggle,
  BudgetPeriodNavigator,
  BudgetUsageCard,
  type BudgetHistoryMode,
} from './BudgetScreenComponents';

type BudgetsScreenProps = {
  snapshot: AppSnapshot;
  onAddBudget: () => void;
  onEditBudget: (budgetId: string) => void;
  onUpdateBudgetOrder: (budgetIds: string[]) => Promise<void>;
};

export function BudgetsScreen({
  snapshot,
  onAddBudget,
  onEditBudget,
  onUpdateBudgetOrder,
}: BudgetsScreenProps) {
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [expandedBudgetId, setExpandedBudgetId] = useState<string | null>(null);
  const [historyMode, setHistoryMode] = useState<BudgetHistoryMode>('current');
  const [periodOffset, setPeriodOffset] = useState(0);
  const budgetRows = useMemo(
    () => getBudgetUsageRowsForSnapshot(snapshot, anchorDate, periodOffset),
    [anchorDate, periodOffset, snapshot],
  );
  const expandedHistory = useMemo(() => {
    const budget = snapshot.budgets.find((candidate) => candidate.id === expandedBudgetId && candidate.isActive);

    if (!budget) {
      return [];
    }

    const input = {
      accounts: snapshot.accounts,
      anchorDate,
      budget,
      categories: snapshot.categories ?? defaultCategories,
      endOffset: periodOffset,
      transactionLines: snapshot.transactionLines,
      transactionLinks: snapshot.transactionLinks,
      transactions: snapshot.transactions,
    };

    return historyMode === 'current'
      ? getBudgetCurrentHistoryPointsForBudget(input)
      : getBudgetCompareHistoryPointsForBudget(input);
  }, [anchorDate, expandedBudgetId, historyMode, periodOffset, snapshot]);

  function renderBudgetRow({ item, drag, isActive }: RenderItemParams<BudgetUsageDisplayRow>) {
    const isHistoryExpanded = item.id === expandedBudgetId;

    return (
      <BudgetUsageCard
        row={item}
        anchorDate={anchorDate}
        dragging={isActive}
        historyPoints={isHistoryExpanded ? expandedHistory : []}
        historyVariant={historyMode === 'compare' || item.budget.period === 'weekly' ? 'bar' : 'line'}
        isHistoryExpanded={isHistoryExpanded}
        onDrag={drag}
        onToggleHistory={() => setExpandedBudgetId((current) => current === item.id ? null : item.id)}
        onPress={() => onEditBudget(item.id)}
        periodOffset={periodOffset}
      />
    );
  }

  return (
    <View style={styles.shell}>
      <View style={styles.fixedHeader}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryText}>
            <Text style={styles.heading}>Budgets</Text>
            <Text style={sharedStyles.mutedSmallText}>Limits using net spending for each budget range.</Text>
          </View>
          <View style={styles.headerActions}>
            <BudgetHistoryModeToggle mode={historyMode} onChange={setHistoryMode} />
            <ActionButton onPress={onAddBudget} testID="add-budget">
              Add
            </ActionButton>
          </View>
        </View>
        <BudgetPeriodNavigator
          offset={periodOffset}
          onNext={() => setPeriodOffset((current) => current + 1)}
          onPrevious={() => setPeriodOffset((current) => current - 1)}
          onReset={() => {
            setAnchorDate(new Date());
            setPeriodOffset(0);
          }}
        />
      </View>
      <DraggableFlatList
        data={budgetRows}
        keyExtractor={(row) => row.id}
        renderItem={renderBudgetRow}
        containerStyle={styles.list}
        ListEmptyComponent={(
          <Card testID="budgets-empty-state">
            <View style={styles.emptyIcon}>
              <Ionicons name="wallet-outline" size={24} color={colors.primaryDark} />
            </View>
            <Text style={styles.emptyTitle}>No active budgets yet</Text>
            <Text style={styles.emptyText}>
              Add an overall, included, or excluded category budget with a calendar or rolling period.
            </Text>
            <ActionButton variant="secondary" onPress={onAddBudget}>
              Add first budget
            </ActionButton>
          </Card>
        )}
        onDragEnd={({ data }) => {
          void onUpdateBudgetOrder(data.map((row) => row.id));
        }}
        activationDistance={8}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function getBudgetUsageRowsForSnapshot(
  snapshot: AppSnapshot,
  anchorDate: Date,
  periodOffset: number,
): BudgetUsageDisplayRow[] {
  const activeBudgets = snapshot.budgets.filter((budget) => budget.isActive);
  const usages = getBudgetUsagesForPeriods({
    accounts: snapshot.accounts,
    anchorDate,
    budgets: activeBudgets,
    categories: snapshot.categories ?? defaultCategories,
    periodOffset,
    transactionLines: snapshot.transactionLines,
    transactionLinks: snapshot.transactionLinks,
    transactions: snapshot.transactions,
  });

  return sortBudgetUsageDisplayRowsByDisplayOrder(getBudgetUsageDisplayRows(usages, snapshot.categories));
}
const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  fixedHeader: {
    backgroundColor: colors.background,
    borderBottomColor: colors.faint,
    borderBottomWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 0,
    gap: spacing.sm,
    justifyContent: 'flex-end',
  },
  list: {
    flex: 1,
  },
  summaryRow: {
    alignItems: 'center',
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  summaryText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  heading: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: '900',
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
    lineHeight: 21,
  },
});
