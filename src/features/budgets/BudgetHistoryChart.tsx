import { memo, useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import type { BudgetHistoryPoint } from '../../domain/budgets';
import { formatMoney } from '../../domain/money';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  BUDGET_HISTORY_LABEL_HEIGHT,
  BUDGET_HISTORY_LINE_WIDTH,
  BUDGET_HISTORY_PLOT_HEIGHT,
  getBudgetHistoryLineAxisLabels,
  getBudgetHistoryLineChartModel,
  getBudgetHistoryPointIndexAtX,
  getBudgetHistoryChartScale,
  shouldShowBudgetHistoryBarLabel,
} from './budgetHistoryChartModel';

type BudgetHistoryChartProps = {
  accentColor: string;
  currencyCode: string;
  points: BudgetHistoryPoint[];
  variant?: 'bar' | 'line';
};

export const BudgetHistoryChart = memo(function BudgetHistoryChart({
  accentColor,
  currencyCode,
  points,
  variant = 'bar',
}: BudgetHistoryChartProps) {
  const [selectedPointId, setSelectedPointId] = useState(points.at(-1)?.id ?? '');
  const [linePressableWidth, setLinePressableWidth] = useState(0);
  const renderedLineWidth = linePressableWidth || BUDGET_HISTORY_LINE_WIDTH;
  const selectedPoint = useMemo(
    () => points.find((point) => point.id === selectedPointId) ?? points.at(-1),
    [points, selectedPointId],
  );

  const scale = useMemo(
    () => selectedPoint ? getBudgetHistoryChartScale(points, selectedPoint) : null,
    [points, selectedPoint],
  );
  const lineModel = useMemo(
    () => selectedPoint
      ? getBudgetHistoryLineChartModel(points, selectedPoint, { width: renderedLineWidth })
      : null,
    [points, renderedLineWidth, selectedPoint],
  );
  const lineAxisLabels = useMemo(
    () => getBudgetHistoryLineAxisLabels(points),
    [points],
  );

  const handleLineLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setLinePressableWidth((currentWidth) => (
      Math.abs(currentWidth - nextWidth) < 1 ? currentWidth : nextWidth
    ));
  }, []);

  const handleLinePress = useCallback((event: GestureResponderEvent) => {
    const selectedIndex = getBudgetHistoryPointIndexAtX({
      pointCount: points.length,
      width: renderedLineWidth,
      x: event.nativeEvent.locationX,
    });
    const nextPoint = points[selectedIndex];

    if (nextPoint) {
      setSelectedPointId(nextPoint.id);
    }
  }, [points, renderedLineWidth]);

  if (!selectedPoint || !scale || !lineModel) {
    return null;
  }

  return (
    <View style={styles.history} testID="budget-history-chart">
      <View style={styles.historyHeading}>
        <Text style={styles.historyTitle}>History</Text>
        <Text style={styles.historyRange}>{selectedPoint.rangeLabel}</Text>
      </View>

      <View style={styles.detailRow}>
        <HistoryMetric
          label="Used"
          value={formatMoney(selectedPoint.spentMinor, currencyCode)}
        />
        <HistoryMetric
          label={selectedPoint.remainingMinor < 0 ? 'Over' : 'Remaining'}
          tone={selectedPoint.remainingMinor < 0 ? 'danger' : 'default'}
          value={formatMoney(Math.abs(selectedPoint.remainingMinor), currencyCode)}
        />
        <HistoryMetric
          align="right"
          label="Percent"
          value={`${Math.min(selectedPoint.percentageUsed, 999)}%`}
        />
      </View>

      {variant === 'line' ? (
        <View style={styles.plot}>
          <Pressable
            accessibilityLabel={`${selectedPoint.rangeLabel}, ${formatMoney(selectedPoint.spentMinor, currencyCode)} used`}
            accessibilityRole="button"
            onLayout={handleLineLayout}
            onPress={handleLinePress}
            style={({ pressed }) => [styles.linePressable, pressed && styles.pressed]}
            testID="budget-history-line-chart"
          >
            <Svg
              pointerEvents="none"
              width="100%"
              height={BUDGET_HISTORY_PLOT_HEIGHT}
              viewBox={`0 0 ${renderedLineWidth} ${BUDGET_HISTORY_PLOT_HEIGHT}`}
              testID="budget-history-line-svg"
            >
              <Line
                x1={0}
                x2={renderedLineWidth}
                y1={lineModel.limitY}
                y2={lineModel.limitY}
                stroke={colors.ink}
                strokeDasharray="5 4"
                strokeWidth={1}
              />
              <Polyline
                fill="none"
                points={lineModel.polylinePoints}
                stroke={accentColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
              />
              {lineModel.selectedChartPoint ? (
                <Circle
                  cx={lineModel.selectedChartPoint.x}
                  cy={lineModel.selectedChartPoint.y}
                  fill={selectedPoint.status === 'over_budget' ? colors.danger : accentColor}
                  r={5}
                  stroke={colors.surface}
                  strokeWidth={2}
                  testID="budget-history-selected-chart-point"
                />
              ) : null}
            </Svg>
            <Text style={[styles.limitLabel, styles.lineLimitLabel, { top: Math.max(0, lineModel.limitY - 14) }]}>
              Limit
            </Text>
          </Pressable>
          <View style={styles.lineAxisRow}>
            {lineAxisLabels.map((label) => (
              <Text
                key={`${label.index}:${label.label}`}
                numberOfLines={1}
                style={[
                  styles.lineAxisLabel,
                  label.align === 'center' && styles.lineAxisLabelCenter,
                  label.align === 'right' && styles.lineAxisLabelRight,
                ]}
              >
                {label.label}
              </Text>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.plot}>
          <View style={[styles.limitLine, { bottom: scale.limitBottom }]}>
            <Text style={styles.limitLabel}>Limit</Text>
          </View>
          <View style={styles.barRow}>
            {points.map((point, index) => {
              const isSelected = point.id === selectedPoint.id;
              const barHeight = scale.getBarHeight(point);
              const barColor = point.status === 'over_budget' ? colors.danger : accentColor;
              const showLabel = shouldShowBudgetHistoryBarLabel({
                index,
                isSelected,
                pointCount: points.length,
              });

              return (
                <Pressable
                  accessibilityLabel={`${point.rangeLabel}, ${formatMoney(point.spentMinor, currencyCode)} used`}
                  accessibilityRole="button"
                  key={point.id}
                  onPress={() => setSelectedPointId(point.id)}
                  style={styles.barColumn}
                  testID={`budget-history-bar-${point.offset}`}
                >
                  <View style={styles.barSlot}>
                    <View
                      style={[
                        styles.bar,
                        {
                          backgroundColor: point.spentMinor > 0 ? barColor : colors.faint,
                          height: barHeight,
                        },
                        isSelected && styles.selectedBar,
                      ]}
                    />
                  </View>
                  <Text numberOfLines={1} style={[styles.barLabel, isSelected && styles.selectedBarLabel]}>
                    {showLabel ? point.shortLabel : ' '}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Text style={styles.limitText}>
        Limit {formatMoney(selectedPoint.limitMinor, currencyCode)}
      </Text>
    </View>
  );
});

function HistoryMetric({
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
    <View style={[styles.metric, align === 'right' && styles.metricRight]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, tone === 'danger' && styles.dangerText]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  history: {
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  historyHeading: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  historyTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  historyRange: {
    color: colors.muted,
    flexShrink: 1,
    fontSize: typography.small,
    fontWeight: '700',
    textAlign: 'right',
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  metric: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  metricRight: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  dangerText: {
    color: colors.danger,
  },
  plot: {
    height: BUDGET_HISTORY_PLOT_HEIGHT + BUDGET_HISTORY_LABEL_HEIGHT,
    position: 'relative',
  },
  limitLine: {
    borderTopColor: colors.ink,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 1,
  },
  limitLabel: {
    backgroundColor: colors.surface,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    paddingLeft: spacing.xs,
    position: 'absolute',
    right: 0,
    top: -14,
  },
  barRow: {
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.xs,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  barColumn: {
    flex: 1,
    minWidth: 0,
  },
  barSlot: {
    height: BUDGET_HISTORY_PLOT_HEIGHT,
    justifyContent: 'flex-end',
    paddingHorizontal: 2,
  },
  bar: {
    borderRadius: 3,
    minWidth: 8,
    opacity: 0.72,
    width: '100%',
  },
  selectedBar: {
    borderColor: colors.ink,
    borderWidth: 2,
    opacity: 1,
  },
  barLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  selectedBarLabel: {
    color: colors.ink,
    fontWeight: '900',
  },
  lineAxisLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'left',
  },
  lineAxisLabelCenter: {
    textAlign: 'center',
  },
  lineAxisLabelRight: {
    textAlign: 'right',
  },
  lineAxisRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  lineLimitLabel: {
    position: 'absolute',
  },
  linePressable: {
    height: BUDGET_HISTORY_PLOT_HEIGHT,
    position: 'relative',
  },
  pressed: {
    opacity: 0.78,
  },
  limitText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
    textAlign: 'right',
  },
});
