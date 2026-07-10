import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { Card } from '../../components/ui';
import type { StatsCategoryChangeRow } from '../../domain/statsCategoryChanges';
import type { StatsReportKind } from '../../domain/statsReports';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatSignedMoney } from './StatsScreenUtils';

export function StatsCategoryChangesCard({
  currencyCode,
  onOpenCategory,
  reportKind,
  rows,
}: {
  currencyCode: string;
  onOpenCategory?: (categoryId: string) => void;
  reportKind: StatsReportKind;
  rows: StatsCategoryChangeRow[];
}) {
  const maxAbsChangeMinor = rows.reduce(
    (maximum, row) => Math.max(maximum, Math.abs(row.changeMinor)),
    0,
  );

  return (
    <Card testID="stats-category-changes-card">
      <View style={styles.header}>
        <Text style={styles.title}>Category changes</Text>
        <Text style={styles.subtitle}>Compared with previous period</Text>
      </View>

      {rows.length ? (
        <View style={styles.rows}>
          {rows.map((row, index) => (
            <CategoryChangeRow
              key={row.categoryId}
              currencyCode={currencyCode}
              maxAbsChangeMinor={maxAbsChangeMinor}
              onPress={onOpenCategory ? () => onOpenCategory(row.categoryId) : undefined}
              reportKind={reportKind}
              row={row}
              showSeparator={index < rows.length - 1}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText} testID="stats-category-changes-empty">
          No category changes for this period.
        </Text>
      )}
    </Card>
  );
}

function CategoryChangeRow({
  currencyCode,
  maxAbsChangeMinor,
  onPress,
  reportKind,
  row,
  showSeparator,
}: {
  currencyCode: string;
  maxAbsChangeMinor: number;
  onPress?: () => void;
  reportKind: StatsReportKind;
  row: StatsCategoryChangeRow;
  showSeparator: boolean;
}) {
  const barPercentage = maxAbsChangeMinor > 0
    ? Math.min(100, (Math.abs(row.changeMinor) / maxAbsChangeMinor) * 100)
    : 0;
  const changeColor = getChangeColor(row.direction, reportKind);
  const percentageLabel = formatPercentageChange(row.percentageChange);

  return (
    <Pressable
      accessibilityLabel={`${row.categoryName}, ${formatSignedMoney(row.changeMinor, currencyCode)}${percentageLabel ? `, ${percentageLabel}` : ''}`}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        showSeparator && styles.rowSeparator,
        pressed && styles.pressed,
      ]}
      testID={`stats-category-change-${row.categoryId}`}
    >
      <View style={styles.rowLayout}>
        <CategoryIconBadge color={row.categoryColor} icon={row.categoryIcon} size="sm" />
        <View style={styles.rowBody}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.categoryName}>{row.categoryName}</Text>
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              numberOfLines={1}
              style={[styles.changeAmount, { color: changeColor }]}
              testID={`stats-category-change-amount-${row.categoryId}`}
            >
              {formatSignedMoney(row.changeMinor, currencyCode)}
            </Text>
          </View>

          <View style={styles.visualRow}>
            <View style={styles.percentageSlot}>
              {percentageLabel ? (
                <Text
                  adjustsFontSizeToFit
                  minimumFontScale={0.78}
                  numberOfLines={1}
                  style={[styles.changePercent, { color: changeColor }]}
                  testID={`stats-category-change-percent-${row.categoryId}`}
                >
                  {percentageLabel}
                </Text>
              ) : null}
            </View>
            <View style={styles.barTrack} testID={`stats-category-change-bar-${row.categoryId}`}>
              <View style={styles.barHalf}>
                {row.direction === 'decrease' ? (
                  <View style={[styles.bar, styles.leftBar, { backgroundColor: changeColor, width: `${barPercentage}%` }]} />
                ) : null}
              </View>
              <View style={styles.zeroAxis} />
              <View style={styles.barHalf}>
                {row.direction === 'increase' ? (
                  <View style={[styles.bar, styles.rightBar, { backgroundColor: changeColor, width: `${barPercentage}%` }]} />
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function getChangeColor(
  direction: StatsCategoryChangeRow['direction'],
  reportKind: StatsReportKind,
): string {
  if (direction === 'unchanged') {
    return colors.muted;
  }

  const isFavorable = reportKind === 'expense' ? direction === 'decrease' : direction === 'increase';
  return isFavorable ? colors.success : colors.danger;
}

function formatPercentageChange(percentageChange: number | null): string | null {
  if (percentageChange === null) {
    return null;
  }

  if (percentageChange === 0) {
    return '0%';
  }

  const rounded = Math.abs(percentageChange) >= 100
    ? percentageChange.toFixed(0)
    : percentageChange.toFixed(1);
  return `${percentageChange > 0 ? '+' : ''}${rounded}%`;
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  rows: {
    marginHorizontal: -spacing.xs,
  },
  row: {
    minHeight: 54,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  rowSeparator: {
    borderBottomColor: colors.faint,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLayout: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  categoryName: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    minWidth: 0,
  },
  visualRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  percentageSlot: {
    flexShrink: 0,
    width: 54,
  },
  changeAmount: {
    flexShrink: 0,
    fontSize: typography.body,
    fontWeight: '900',
    maxWidth: '44%',
    textAlign: 'right',
  },
  changePercent: {
    fontSize: typography.small,
    fontWeight: '800',
  },
  barTrack: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'row',
    height: 10,
    minWidth: 0,
    position: 'relative',
  },
  barHalf: {
    flex: 1,
    justifyContent: 'center',
  },
  bar: {
    height: 8,
  },
  leftBar: {
    alignSelf: 'flex-end',
    borderBottomLeftRadius: 999,
    borderTopLeftRadius: 999,
  },
  rightBar: {
    alignSelf: 'flex-start',
    borderBottomRightRadius: 999,
    borderTopRightRadius: 999,
  },
  zeroAxis: {
    alignSelf: 'center',
    backgroundColor: colors.ink,
    height: 12,
    opacity: 0.6,
    width: 1,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
