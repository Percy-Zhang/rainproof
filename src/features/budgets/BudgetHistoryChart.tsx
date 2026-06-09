import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BudgetHistoryPoint } from '../../domain/budgets';
import { formatMoney } from '../../domain/money';
import { colors, spacing, typography } from '../../theme/tokens';

const PLOT_HEIGHT = 104;

export function BudgetHistoryChart({
  accentColor,
  currencyCode,
  points,
}: {
  accentColor: string;
  currencyCode: string;
  points: BudgetHistoryPoint[];
}) {
  const [selectedPointId, setSelectedPointId] = useState(points.at(-1)?.id ?? '');
  const selectedPoint = points.find((point) => point.id === selectedPointId) ?? points.at(-1);

  if (!selectedPoint) {
    return null;
  }

  const maximumSpent = Math.max(...points.map((point) => point.spentMinor), 0);
  const scaleMaximum = Math.max(selectedPoint.limitMinor * 1.15, maximumSpent * 1.08, 1);
  const limitBottom = Math.min(
    PLOT_HEIGHT - 1,
    Math.max(1, Math.round((selectedPoint.limitMinor / scaleMaximum) * PLOT_HEIGHT)),
  );

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

      <View style={styles.plot}>
        <View style={[styles.limitLine, { bottom: limitBottom }]}>
          <Text style={styles.limitLabel}>Limit</Text>
        </View>
        <View style={styles.barRow}>
          {points.map((point) => {
            const isSelected = point.id === selectedPoint.id;
            const barHeight = point.spentMinor > 0
              ? Math.max(3, Math.round((point.spentMinor / scaleMaximum) * PLOT_HEIGHT))
              : 2;
            const barColor = point.status === 'over_budget' ? colors.danger : accentColor;

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
                  {point.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.limitText}>
        Limit {formatMoney(selectedPoint.limitMinor, currencyCode)}
      </Text>
    </View>
  );
}

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
    height: PLOT_HEIGHT + 24,
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
    height: PLOT_HEIGHT,
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
  limitText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
    textAlign: 'right',
  },
});
