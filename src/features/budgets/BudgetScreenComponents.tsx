import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { ProgressBar, SurfaceCard } from '../../components/ui';
import {
  formatBudgetPeriodRange,
  getBudgetPeriodOffsetLabel,
  getBudgetPeriodRange,
  type BudgetHistoryPoint,
  type BudgetUsageDisplayRow,
} from '../../domain/budgets';
import { formatMoney } from '../../domain/money';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import { BudgetHistoryChart } from './BudgetHistoryChart';

export type BudgetHistoryMode = 'current' | 'compare';

export function BudgetUsageCard({
  anchorDate,
  dragging,
  historyPoints,
  historyVariant,
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
  historyVariant: 'bar' | 'line';
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
      <SurfaceCard
        style={dragging && sharedStyles.draggingSurface}
        testID={`budget-row-${row.id}`}
      >
        <Pressable
          accessibilityHint="Long press to reorder."
          accessibilityRole="button"
          delayLongPress={150}
          onLongPress={onDrag}
          onPress={onPress}
          style={({ pressed }) => [styles.budgetContent, pressed && sharedStyles.pressed]}
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
            <AmountBlock
              label={status.remainingLabel}
              value={formatMoney(Math.abs(row.remainingMinor), row.budget.currencyCode)}
              tone={row.remainingMinor < 0 ? 'danger' : 'default'}
            />
            <AmountBlock
              align="right"
              label="Limit"
              value={formatMoney(row.budget.amountMinor, row.budget.currencyCode)}
            />
          </View>

          <ProgressBar percentage={row.percentageUsed} color={progressColor} />
          <Text style={styles.progressText}>{Math.min(row.percentageUsed, 999)}% used in this period</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isHistoryExpanded }}
          onPress={onToggleHistory}
          style={({ pressed }) => [styles.historyToggle, pressed && sharedStyles.pressed]}
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
            key={`${row.id}:${periodOffset}:${historyVariant}`}
            points={historyPoints}
            variant={historyVariant}
          />
        ) : null}
      </SurfaceCard>
    </ScaleDecorator>
  );
}

export function BudgetPeriodNavigator({
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
    <View style={[sharedStyles.rowSurface, styles.periodNavigator]}>
      <Pressable
        accessibilityLabel="Previous budget ranges"
        onPress={onPrevious}
        style={({ pressed }) => [styles.periodNavButton, pressed && sharedStyles.pressed]}
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
        style={({ pressed }) => [styles.periodNavButton, pressed && sharedStyles.pressed]}
        testID="budget-period-next"
      >
        <Ionicons name="chevron-forward" size={20} color={colors.primaryDark} />
      </Pressable>
    </View>
  );
}

export function BudgetHistoryModeToggle({
  mode,
  onChange,
}: {
  mode: BudgetHistoryMode;
  onChange: (mode: BudgetHistoryMode) => void;
}) {
  return (
    <View accessibilityLabel="Budget history mode" style={styles.historyModeToggle}>
      {(['current', 'compare'] as const).map((value) => {
        const selected = mode === value;
        const label = value === 'current' ? 'Current' : 'Compare';

        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={value}
            onPress={() => onChange(value)}
            style={({ pressed }) => [
              styles.historyModeOption,
              selected && styles.historyModeOptionSelected,
              pressed && sharedStyles.pressed,
            ]}
            testID={`budget-history-mode-${value}`}
          >
            <Text style={[styles.historyModeText, selected && styles.historyModeTextSelected]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
  amountBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  amountBlockRight: {
    alignItems: 'flex-end',
  },
  amountGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
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
  budgetContent: {
    gap: spacing.md,
  },
  budgetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  budgetName: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  budgetTitleWrap: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  currentPeriodAction: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '800',
  },
  dangerText: {
    color: colors.danger,
  },
  historyModeOption: {
    borderRadius: 7,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  historyModeOptionSelected: {
    backgroundColor: colors.primaryDark,
  },
  historyModeText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  historyModeTextSelected: {
    color: colors.surface,
  },
  historyModeToggle: {
    backgroundColor: colors.faint,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 2,
    padding: 2,
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
  periodNavButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  periodNavigator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  periodNavigatorLabel: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  periodNavigatorText: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  periodText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  progressText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
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
});
