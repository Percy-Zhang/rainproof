import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { ActionButton, Card, ProgressBar } from '../../components/ui';
import {
  formatBudgetPeriodRange,
  getBudgetHistoryForBudget,
  getBudgetPeriodOffsetLabel,
  getBudgetPeriodRange,
  getBudgetUsageDisplayRows,
  getBudgetUsagesForPeriods,
  sortBudgetUsageDisplayRowsByDisplayOrder,
  type BudgetHistoryPoint,
  type BudgetUsageDisplayRow,
} from '../../domain/budgets';
import { defaultCategories } from '../../domain/categories';
import { formatMoney } from '../../domain/money';
import type { AppSnapshot } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { BudgetHistoryChart } from './BudgetHistoryChart';

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
  const [periodOffset, setPeriodOffset] = useState(0);
  const budgetRows = useMemo(
    () => getBudgetUsageRowsForSnapshot(snapshot, anchorDate, periodOffset),
    [anchorDate, periodOffset, snapshot],
  );
  const expandedHistory = useMemo(() => {
    const budget = snapshot.budgets.find((candidate) => candidate.id === expandedBudgetId && candidate.isActive);

    return budget
      ? getBudgetHistoryForBudget({
          accounts: snapshot.accounts,
          anchorDate,
          budget,
          categories: snapshot.categories ?? defaultCategories,
          endOffset: periodOffset,
          transactionLines: snapshot.transactionLines,
          transactionLinks: snapshot.transactionLinks,
          transactions: snapshot.transactions,
        })
      : [];
  }, [anchorDate, expandedBudgetId, periodOffset, snapshot]);

  function renderBudgetRow({ item, drag, isActive }: RenderItemParams<BudgetUsageDisplayRow>) {
    const isHistoryExpanded = item.id === expandedBudgetId;

    return (
      <BudgetUsageCard
        row={item}
        anchorDate={anchorDate}
        dragging={isActive}
        historyPoints={isHistoryExpanded ? expandedHistory : []}
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
      <DraggableFlatList
        data={budgetRows}
        keyExtractor={(row) => row.id}
        renderItem={renderBudgetRow}
        ListHeaderComponent={(
          <View style={styles.header}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryText}>
                <Text style={styles.heading}>Budgets</Text>
                <Text style={styles.subtle}>Limits using net spending for each budget range.</Text>
              </View>
              <ActionButton onPress={onAddBudget} testID="add-budget">
                Add
              </ActionButton>
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
        )}
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

function BudgetUsageCard({
  anchorDate,
  dragging,
  historyPoints,
  isHistoryExpanded,
  onDrag,
  row,
  onToggleHistory,
  onPress,
  periodOffset,
}: {
  anchorDate: Date;
  dragging: boolean;
  historyPoints: BudgetHistoryPoint[];
  isHistoryExpanded: boolean;
  onDrag: () => void;
  onToggleHistory: () => void;
  row: BudgetUsageDisplayRow;
  onPress: () => void;
  periodOffset: number;
}) {
  const status = getStatusCopy(row);
  const progressColor = getBudgetStatusColor(row.status);
  const range = getBudgetPeriodRange(row.budget.period, anchorDate, periodOffset);
  const periodLabel = getBudgetPeriodOffsetLabel(row.budget.period, periodOffset);

  return (
    <ScaleDecorator>
      <View style={[styles.budgetCard, dragging && styles.draggingCard]} testID={`budget-row-${row.id}`}>
        <Pressable
          accessibilityHint="Long press to reorder."
          accessibilityRole="button"
          delayLongPress={150}
          onLongPress={onDrag}
          onPress={onPress}
          style={({ pressed }) => [styles.budgetContent, pressed && styles.pressed]}
        >
          <View style={styles.budgetHeader}>
            <CategoryIconBadge color={row.color} icon={row.icon} size="md" />
            <View style={styles.budgetTitleWrap}>
              <Text numberOfLines={1} style={styles.budgetName}>{row.budget.name}</Text>
              <Text numberOfLines={1} style={styles.scopeText}>
                {row.scopeLabel}{' \u00B7 '}{row.scopeDetail}
              </Text>
            </View>
            <View style={styles.statusWrap}>
              <Text style={[styles.statusPill, { color: progressColor }]}>{status.label}</Text>
              <Ionicons name="reorder-three-outline" size={20} color={colors.muted} />
            </View>
          </View>

          <Text style={styles.periodText}>
            {periodLabel}{' \u00B7 '}{formatBudgetPeriodRange(range)}
          </Text>

          <View style={styles.amountGrid}>
            <AmountBlock label="Used" value={formatMoney(row.spentMinor, row.budget.currencyCode)} />
            <AmountBlock label={status.remainingLabel} value={formatMoney(Math.abs(row.remainingMinor), row.budget.currencyCode)} tone={row.remainingMinor < 0 ? 'danger' : 'default'} />
            <AmountBlock label="Limit" value={formatMoney(row.budget.amountMinor, row.budget.currencyCode)} align="right" />
          </View>

          <ProgressBar percentage={row.percentageUsed} color={progressColor} />
          <Text style={styles.progressText}>{Math.min(row.percentageUsed, 999)}% used in this period</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isHistoryExpanded }}
          onPress={onToggleHistory}
          style={({ pressed }) => [styles.historyToggle, pressed && styles.pressed]}
          testID={`budget-history-toggle-${row.id}`}
        >
          <View style={styles.historyToggleLabel}>
            <Ionicons name="bar-chart-outline" size={17} color={colors.primaryDark} />
            <Text style={styles.historyToggleText}>History</Text>
          </View>
          <Ionicons
            name={isHistoryExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.primaryDark}
          />
        </Pressable>

        {isHistoryExpanded ? (
          <BudgetHistoryChart
            accentColor={row.color}
            currencyCode={row.budget.currencyCode}
            key={`${row.id}:${periodOffset}`}
            points={historyPoints}
          />
        ) : null}
      </View>
    </ScaleDecorator>
  );
}

function AmountBlock({
  align = 'left',
  label,
  tone = 'default',
  value,
}: {
  align?: 'left' | 'right';
  label: string;
  tone?: 'default' | 'danger';
  value: string;
}) {
  return (
    <View style={[styles.amountBlock, align === 'right' && styles.amountBlockRight]}>
      <Text style={styles.amountLabel}>{label}</Text>
      <Text style={[styles.amountValue, tone === 'danger' && styles.dangerText]}>{value}</Text>
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

function BudgetPeriodNavigator({
  offset,
  onNext,
  onPrevious,
  onReset,
}: {
  offset: number;
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
}) {
  const label =
    offset === 0
      ? 'Current ranges'
      : offset === -1
        ? 'Previous ranges'
        : offset === 1
          ? 'Next ranges'
          : offset < 0
            ? `${Math.abs(offset)} steps back`
            : `${offset} steps ahead`;

  return (
    <View style={styles.periodNavigator}>
      <Pressable
        accessibilityLabel="Previous budget ranges"
        onPress={onPrevious}
        style={({ pressed }) => [styles.periodNavButton, pressed && styles.pressed]}
        testID="budget-period-previous"
      >
        <Ionicons name="chevron-back" size={20} color={colors.primaryDark} />
      </Pressable>
      <View style={styles.periodNavigatorText}>
        <Text style={styles.periodNavigatorLabel}>{label}</Text>
        {offset !== 0 ? (
          <Pressable accessibilityRole="button" onPress={onReset} testID="budget-period-current">
            <Text style={styles.currentPeriodAction}>Current</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel="Next budget ranges"
        onPress={onNext}
        style={({ pressed }) => [styles.periodNavButton, pressed && styles.pressed]}
        testID="budget-period-next"
      >
        <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

function getStatusCopy(row: BudgetUsageDisplayRow): { label: string; remainingLabel: string } {
  if (row.remainingMinor < 0) {
    return { label: 'Over', remainingLabel: 'Over by' };
  }

  if (row.status === 'over_budget') {
    return { label: 'At limit', remainingLabel: 'Remaining' };
  }

  if (row.status === 'near_limit') {
    return { label: 'Near limit', remainingLabel: 'Remaining' };
  }

  return { label: 'Under', remainingLabel: 'Remaining' };
}

function getBudgetStatusColor(status: BudgetUsageDisplayRow['status']): string {
  switch (status) {
    case 'over_budget':
      return colors.danger;
    case 'near_limit':
      return '#9B6B12';
    case 'under_budget':
      return colors.success;
  }
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    gap: spacing.md,
  },
  summaryRow: {
    alignItems: 'center',
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
  subtle: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  periodNavigator: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.sm,
  },
  periodNavButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  periodNavigatorText: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  periodNavigatorLabel: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  currentPeriodAction: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '800',
  },
  budgetCard: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  budgetContent: {
    gap: spacing.md,
  },
  draggingCard: {
    elevation: 8,
    opacity: 0.95,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  budgetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  budgetTitleWrap: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  budgetName: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  scopeText: {
    color: colors.muted,
    fontSize: typography.small,
  },
  statusPill: {
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  statusWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  historyToggle: {
    alignItems: 'center',
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
    paddingTop: spacing.sm,
  },
  historyToggleLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  historyToggleText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  amountGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  amountBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  amountBlockRight: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  amountValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  dangerText: {
    color: colors.danger,
  },
  progressText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  periodText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
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
  pressed: {
    opacity: 0.78,
  },
});
