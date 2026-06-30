import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card } from '../../components/ui';
import {
  getBudgetCompareHistoryPointsForBudget,
  getBudgetCurrentHistoryPointsForBudget,
  getBudgetUsageDisplayRows,
  getBudgetUsagesForPeriods,
  sortBudgetUsageDisplayRowsByDisplayOrder,
  type BudgetHistoryPoint,
  type BudgetUsageDisplayRow,
} from '../../domain/budgets';
import { defaultCategories } from '../../domain/categories';
import {
  haveIdsInSameOrder,
  mergeIdsByPreferredOrder,
  orderItemsById,
  orderItemsByIdOrFallback,
} from '../../domain/reorder';
import type { AppSnapshot } from '../../domain/types';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  BudgetHistoryModeToggle,
  BudgetPeriodNavigator,
  BudgetUsageCard,
  type BudgetHistoryMode,
} from './BudgetScreenComponents';
import { BudgetReorderList } from './BudgetReorderList';
import { useDeferredOrderPersistence } from '../useDeferredOrderPersistence';

type BudgetsScreenProps = {
  snapshot: AppSnapshot;
  onAddBudget: () => void;
  onEditBudget: (budgetId: string) => void;
  onUpdateBudgetOrder: (budgetIds: string[]) => Promise<void>;
};

const EMPTY_BUDGET_HISTORY_POINTS: BudgetHistoryPoint[] = [];

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
  const snapshotBudgetRows = useMemo(
    () => getBudgetUsageRowsForSnapshot(snapshot, anchorDate, periodOffset),
    [anchorDate, periodOffset, snapshot],
  );
  const snapshotBudgetRowIds = useMemo(
    () => snapshotBudgetRows.map((row) => row.id),
    [snapshotBudgetRows],
  );
  const pendingBudgetOrderIdsRef = useRef<string[] | null>(null);
  const budgetDragActiveRef = useRef(false);
  const budgetDropSettlingRef = useRef(false);
  const budgetDragStartIdsRef = useRef<string[] | null>(null);
  const visualBudgetRowIdsRef = useRef(snapshotBudgetRowIds);
  const latestSnapshotBudgetRowsRef = useRef(snapshotBudgetRows);
  const latestSnapshotBudgetRowIdsRef = useRef(snapshotBudgetRowIds);
  const [budgetRows, setBudgetRows] = useState(() => snapshotBudgetRows);
  const scheduleBudgetOrderPersistence = useDeferredOrderPersistence(onUpdateBudgetOrder);

  const syncBudgetRowsFromSnapshot = useCallback((
    nextSnapshotRows = latestSnapshotBudgetRowsRef.current,
    nextSnapshotIds = latestSnapshotBudgetRowIdsRef.current,
  ) => {
    setBudgetRows((currentRows) => {
      const pendingIds = pendingBudgetOrderIdsRef.current;
      const currentIds = currentRows.map((row) => row.id);
      if (!pendingIds) {
        visualBudgetRowIdsRef.current = nextSnapshotIds;
        return nextSnapshotRows;
      }

      const mergedIds = mergeIdsByPreferredOrder(nextSnapshotIds, pendingIds);
      if (haveIdsInSameOrder(nextSnapshotIds, mergedIds)) {
        pendingBudgetOrderIdsRef.current = null;
        visualBudgetRowIdsRef.current = nextSnapshotIds;
        if (haveIdsInSameOrder(currentIds, nextSnapshotIds)) {
          return currentRows;
        }

        return nextSnapshotRows;
      }

      const nextRows = orderItemsById(nextSnapshotRows, mergedIds);
      visualBudgetRowIdsRef.current = nextRows.map((row) => row.id);
      pendingBudgetOrderIdsRef.current = mergedIds;
      return nextRows;
    });
  }, []);

  useEffect(() => {
    latestSnapshotBudgetRowsRef.current = snapshotBudgetRows;
    latestSnapshotBudgetRowIdsRef.current = snapshotBudgetRowIds;

    if (budgetDragActiveRef.current || budgetDropSettlingRef.current) {
      return;
    }

    syncBudgetRowsFromSnapshot(snapshotBudgetRows, snapshotBudgetRowIds);
  }, [snapshotBudgetRowIds, snapshotBudgetRows, syncBudgetRowsFromSnapshot]);

  const handleDragBegin = useCallback(() => {
    budgetDragActiveRef.current = true;
    budgetDropSettlingRef.current = true;
    budgetDragStartIdsRef.current = visualBudgetRowIdsRef.current;
    setExpandedBudgetId(null);
  }, []);

  const handleDragEnd = useCallback((nextIds: string[]) => {
    const dragStartIds = budgetDragStartIdsRef.current ?? visualBudgetRowIdsRef.current;
    budgetDragActiveRef.current = false;
    budgetDragStartIdsRef.current = null;

    if (haveIdsInSameOrder(dragStartIds, nextIds)) {
      budgetDropSettlingRef.current = false;
      syncBudgetRowsFromSnapshot();
      return;
    }

    budgetDropSettlingRef.current = true;
    pendingBudgetOrderIdsRef.current = nextIds;
    visualBudgetRowIdsRef.current = nextIds;
    setBudgetRows((currentRows) => orderItemsByIdOrFallback(currentRows, nextIds, currentRows));
    budgetDropSettlingRef.current = false;
    scheduleBudgetOrderPersistence(nextIds);
  }, [scheduleBudgetOrderPersistence, syncBudgetRowsFromSnapshot]);

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

  const handleToggleBudgetHistory = useCallback((budgetId: string) => {
    setExpandedBudgetId((current) => current === budgetId ? null : budgetId);
  }, []);

  const handlePressBudget = useCallback((budgetId: string) => {
    onEditBudget(budgetId);
  }, [onEditBudget]);

  const renderBudgetRow = useCallback((
    row: BudgetUsageDisplayRow,
    { dragging, reorderActive }: { dragging: boolean; reorderActive: boolean },
  ) => {
    const isHistoryExpanded = row.id === expandedBudgetId;

    return (
      <BudgetUsageCard
        row={row}
        anchorDate={anchorDate}
        dragging={dragging}
        historyPoints={isHistoryExpanded ? expandedHistory : EMPTY_BUDGET_HISTORY_POINTS}
        historyVariant={historyMode === 'compare' || row.budget.period === 'weekly' ? 'bar' : 'line'}
        interactionsDisabled={reorderActive}
        isHistoryExpanded={isHistoryExpanded}
        onDrag={noop}
        onToggleHistory={handleToggleBudgetHistory}
        onPress={handlePressBudget}
        periodOffset={periodOffset}
      />
    );
  }, [
    anchorDate,
    expandedBudgetId,
    expandedHistory,
    handlePressBudget,
    handleToggleBudgetHistory,
    historyMode,
    periodOffset,
  ]);

  const emptyBudgets = useMemo(() => (
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
  ), [onAddBudget]);

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
      <BudgetReorderList
        contentContainerStyle={styles.content}
        emptyComponent={emptyBudgets}
        rows={budgetRows}
        renderRow={renderBudgetRow}
        onDragBegin={handleDragBegin}
        onDragEnd={handleDragEnd}
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

function noop() {
  return undefined;
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  content: {
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
