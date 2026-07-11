import { Ionicons } from '@expo/vector-icons';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  memo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, type GestureResponderEvent, View } from 'react-native';
import { runOnJS } from 'react-native-worklets';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

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
import {
  BUDGET_HISTORY_LABEL_HEIGHT,
  BUDGET_HISTORY_PLOT_HEIGHT,
} from './budgetHistoryChartModel';

export type BudgetHistoryMode = 'current' | 'compare';

const BUDGET_HISTORY_REVEAL_IN_DURATION_MS = 200;
const BUDGET_HISTORY_REVEAL_IN_DELAY_MS = 32;
const BUDGET_HISTORY_REVEAL_OUT_DURATION_MS = 170;
const BUDGET_HISTORY_REVEAL_CONTENT_OFFSET = -8;
const BUDGET_HISTORY_REVEAL_CHROME_HEIGHT = 116;
const BUDGET_HISTORY_REVEAL_HEIGHT =
  BUDGET_HISTORY_PLOT_HEIGHT + BUDGET_HISTORY_LABEL_HEIGHT + BUDGET_HISTORY_REVEAL_CHROME_HEIGHT;
const HISTORY_TOGGLE_SCROLL_CANCEL_Y = 10;
const HISTORY_TOGGLE_PRESS_RETENTION_OFFSET = { bottom: 4, left: 8, right: 8, top: 4 };

type BudgetHistoryRevealHandle = {
  animateToExpanded: (expanded: boolean) => void;
};

type BudgetUsageCardProps = {
  anchorDate: Date;
  dragging: boolean;
  historyPoints: BudgetHistoryPoint[];
  historyVariant: 'bar' | 'line';
  interactionsDisabled?: boolean;
  isHistoryExpanded: boolean;
  onToggleHistory: (budgetId: string) => void;
  row: BudgetUsageDisplayRow;
  onPress: (budgetId: string) => void;
  periodOffset: number;
  shouldSuppressPress: () => boolean;
};

export const BudgetUsageCard = memo(function BudgetUsageCard({
  anchorDate,
  dragging,
  historyPoints,
  historyVariant,
  interactionsDisabled = false,
  isHistoryExpanded,
  row,
  onToggleHistory,
  onPress,
  periodOffset,
  shouldSuppressPress,
}: BudgetUsageCardProps) {
  const status = getStatusCopy(row);
  const progressColor = getBudgetStatusColor(row.status);
  const range = getBudgetPeriodRange(row.budget.period, anchorDate, periodOffset);
  const periodLabel = getBudgetPeriodOffsetLabel(row.budget.period, periodOffset);
  const historyRevealRef = useRef<BudgetHistoryRevealHandle>(null);
  const visualHistoryExpandedRef = useRef(isHistoryExpanded);
  const controlsDisabled = dragging || interactionsDisabled;

  useLayoutEffect(() => {
    visualHistoryExpandedRef.current = isHistoryExpanded;
  }, [isHistoryExpanded]);

  const handleToggleHistory = useCallback(() => {
    if (shouldSuppressPress()) {
      return;
    }

    const nextExpanded = !visualHistoryExpandedRef.current;
    visualHistoryExpandedRef.current = nextExpanded;
    historyRevealRef.current?.animateToExpanded(nextExpanded);
    onToggleHistory(row.id);
  }, [onToggleHistory, row.id, shouldSuppressPress]);

  const handlePress = useCallback(() => {
    if (!shouldSuppressPress()) {
      onPress(row.id);
    }
  }, [onPress, row.id, shouldSuppressPress]);

  const historyTogglePressHandlers = useScrollAwarePressHandlers(handleToggleHistory, !controlsDisabled);

  return (
    <View style={styles.reorderRowFrame}>
      <SurfaceCard
        style={[
          dragging && sharedStyles.draggingSurface,
          dragging && sharedStyles.draggingLift,
        ]}
        testID={`budget-row-${row.id}`}
      >
        <Pressable
          accessibilityHint="Long press to reorder."
          accessibilityRole="button"
          disabled={controlsDisabled}
          onPress={handlePress}
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
          disabled={controlsDisabled}
          {...historyTogglePressHandlers}
          pressRetentionOffset={HISTORY_TOGGLE_PRESS_RETENTION_OFFSET}
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

        <BudgetHistoryReveal
          ref={historyRevealRef}
          expanded={isHistoryExpanded}
          snapChanges={controlsDisabled}
        >
          <BudgetHistoryChart
            accentColor={row.color}
            currencyCode={row.budget.currencyCode}
            key={`${row.id}:${periodOffset}:${historyVariant}`}
            points={historyPoints}
            variant={historyVariant}
          />
        </BudgetHistoryReveal>
      </SurfaceCard>
    </View>
  );
}, areBudgetUsageCardPropsEqual);

function areBudgetUsageCardPropsEqual(
  previous: BudgetUsageCardProps,
  next: BudgetUsageCardProps,
) {
  return (
    previous.anchorDate === next.anchorDate &&
    previous.dragging === next.dragging &&
    previous.historyPoints === next.historyPoints &&
    previous.historyVariant === next.historyVariant &&
    previous.interactionsDisabled === next.interactionsDisabled &&
    previous.isHistoryExpanded === next.isHistoryExpanded &&
    previous.onPress === next.onPress &&
    previous.onToggleHistory === next.onToggleHistory &&
    previous.periodOffset === next.periodOffset &&
    previous.row === next.row &&
    previous.shouldSuppressPress === next.shouldSuppressPress
  );
}

type BudgetHistoryRevealProps = {
  children: ReactNode;
  expanded: boolean;
  snapChanges: boolean;
};

const BudgetHistoryReveal = forwardRef<BudgetHistoryRevealHandle, BudgetHistoryRevealProps>(
  function BudgetHistoryReveal(
    {
      children,
      expanded,
      snapChanges,
    },
    ref,
  ) {
    const childrenRef = useRef(children);
    childrenRef.current = children;
    const pendingManualTargetRef = useRef<boolean | null>(null);
    const revealExpandedRef = useRef(expanded);
    const [renderedChildren, setRenderedChildren] = useState<ReactNode>(expanded ? children : null);
    const [shouldRender, setShouldRender] = useState(expanded);
    const revealHeight = useSharedValue(expanded ? BUDGET_HISTORY_REVEAL_HEIGHT : 0);
    const contentOpacity = useSharedValue(expanded ? 1 : 0);
    const contentTranslateY = useSharedValue(expanded ? 0 : BUDGET_HISTORY_REVEAL_CONTENT_OFFSET);

    const finishCollapse = useCallback(() => {
      if (revealExpandedRef.current) {
        return;
      }

      setRenderedChildren(null);
      setShouldRender(false);
    }, []);

    const prepareExpandedContent = useCallback(() => {
      setRenderedChildren(childrenRef.current);
      setShouldRender(true);
    }, []);

    const animateToExpanded = useCallback((nextExpanded: boolean, manual = false) => {
      if (manual) {
        pendingManualTargetRef.current = nextExpanded;
      }

      revealExpandedRef.current = nextExpanded;
      cancelAnimation(revealHeight);
      cancelAnimation(contentOpacity);
      cancelAnimation(contentTranslateY);

      if (snapChanges) {
        revealHeight.value = nextExpanded ? BUDGET_HISTORY_REVEAL_HEIGHT : 0;
        contentOpacity.value = nextExpanded ? 1 : 0;
        contentTranslateY.value = nextExpanded ? 0 : BUDGET_HISTORY_REVEAL_CONTENT_OFFSET;

        if (nextExpanded) {
          prepareExpandedContent();
        } else {
          finishCollapse();
        }

        return;
      }

      if (nextExpanded) {
        prepareExpandedContent();
        revealHeight.value = BUDGET_HISTORY_REVEAL_HEIGHT;
        contentOpacity.value = 0;
        contentTranslateY.value = BUDGET_HISTORY_REVEAL_CONTENT_OFFSET;
        contentOpacity.value = withDelay(
          BUDGET_HISTORY_REVEAL_IN_DELAY_MS,
          withTiming(1, {
            duration: BUDGET_HISTORY_REVEAL_IN_DURATION_MS,
            easing: Easing.out(Easing.cubic),
          }),
        );
        contentTranslateY.value = withDelay(
          BUDGET_HISTORY_REVEAL_IN_DELAY_MS,
          withTiming(0, {
            duration: BUDGET_HISTORY_REVEAL_IN_DURATION_MS,
            easing: Easing.out(Easing.cubic),
          }),
        );

        return;
      }

      setShouldRender(true);
      contentOpacity.value = withTiming(0, {
        duration: BUDGET_HISTORY_REVEAL_OUT_DURATION_MS,
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) {
          revealHeight.value = 0;
          runOnJS(finishCollapse)();
        }
      });
      contentTranslateY.value = withTiming(BUDGET_HISTORY_REVEAL_CONTENT_OFFSET, {
        duration: BUDGET_HISTORY_REVEAL_OUT_DURATION_MS,
        easing: Easing.in(Easing.cubic),
      });
    }, [
      contentOpacity,
      contentTranslateY,
      finishCollapse,
      prepareExpandedContent,
      revealHeight,
      snapChanges,
    ]);

    useImperativeHandle(ref, () => ({
      animateToExpanded: (nextExpanded) => animateToExpanded(nextExpanded, true),
    }), [animateToExpanded]);

    useEffect(() => {
      if (expanded) {
        setRenderedChildren(children);
        setShouldRender(true);
      }
    }, [children, expanded]);

    useEffect(() => {
      if (pendingManualTargetRef.current === expanded) {
        pendingManualTargetRef.current = null;
        return;
      }

      if (revealExpandedRef.current === expanded) {
        return;
      }

      animateToExpanded(expanded);
    }, [animateToExpanded, expanded]);

    const layoutAnimatedStyle = useAnimatedStyle(() => ({
      height: revealHeight.value,
    }));

    const contentAnimatedStyle = useAnimatedStyle(() => ({
      opacity: contentOpacity.value,
      transform: [{ translateY: contentTranslateY.value }],
    }));

    if (!shouldRender) {
      return null;
    }

    return (
      <Animated.View
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
        pointerEvents={expanded ? 'auto' : 'none'}
        style={[styles.historyReveal, layoutAnimatedStyle]}
      >
        <Animated.View style={[styles.historyRevealContent, contentAnimatedStyle]}>
          {renderedChildren}
        </Animated.View>
      </Animated.View>
    );
  },
);

function useScrollAwarePressHandlers(onPress: () => void, enabled: boolean) {
  const startPageYRef = useRef<number | null>(null);
  const cancelledByScrollRef = useRef(false);

  const resetTouchTracking = useCallback(() => {
    startPageYRef.current = null;
    cancelledByScrollRef.current = false;
  }, []);

  const handlePressIn = useCallback((event: GestureResponderEvent) => {
    if (!enabled) {
      return;
    }

    startPageYRef.current = event.nativeEvent.pageY;
    cancelledByScrollRef.current = false;
  }, [enabled]);

  const handleTouchMove = useCallback((event: GestureResponderEvent) => {
    if (!enabled || startPageYRef.current === null || cancelledByScrollRef.current) {
      return;
    }

    if (Math.abs(event.nativeEvent.pageY - startPageYRef.current) > HISTORY_TOGGLE_SCROLL_CANCEL_Y) {
      cancelledByScrollRef.current = true;
    }
  }, [enabled]);

  const handlePress = useCallback(() => {
    if (!enabled) {
      resetTouchTracking();
      return;
    }

    const wasCancelledByScroll = cancelledByScrollRef.current;
    resetTouchTracking();
    if (wasCancelledByScroll) {
      return;
    }

    onPress();
  }, [enabled, onPress, resetTouchTracking]);

  return {
    onPress: handlePress,
    onPressIn: enabled ? handlePressIn : undefined,
    onTouchCancel: resetTouchTracking,
    onTouchMove: enabled ? handleTouchMove : undefined,
  };
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
  historyReveal: {
    overflow: 'hidden',
    width: '100%',
  },
  historyRevealContent: {
    width: '100%',
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
  reorderRowFrame: {
    paddingBottom: spacing.md,
    width: '100%',
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
