import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';

import { Card } from '../../components/ui';
import { formatLongDateLabel } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { colors, spacing, typography } from '../../theme/tokens';
import { formatSignedMoney, getNetTone } from './StatsScreenUtils';
import {
  getStatsBalanceHistoryAxisLabels,
  getStatsBalanceHistoryChartModel,
  getStatsBalanceHistoryEventMarkerAtPosition,
  getStatsBalanceHistoryPointIndexAtX,
  STATS_BALANCE_HISTORY_CHART_HEIGHT,
  STATS_BALANCE_HISTORY_CHART_WIDTH,
  type StatsBalanceHistoryDisplayPoint,
  type StatsBalanceHistoryMode,
} from './statsBalanceHistory';

const balanceHistoryModeOptions: { id: StatsBalanceHistoryMode; label: string }[] = [
  { id: 'history', label: 'History' },
  { id: 'combined', label: 'Combined' },
  { id: 'forecast', label: 'Forecast' },
];

const eventMarkerRadius = 4.5;
const selectedEventMarkerRadius = 6;

type StatsBalanceHistoryCardProps = {
  currencyCode: string;
  emptyLabel: string;
  mode: StatsBalanceHistoryMode;
  onSelectMode: (mode: StatsBalanceHistoryMode) => void;
  onSelectPoint: (pointId: string) => void;
  points: StatsBalanceHistoryDisplayPoint[];
  selectedChangeMinor: number;
  selectedPoint?: StatsBalanceHistoryDisplayPoint;
};

export const StatsBalanceHistoryCard = memo(function StatsBalanceHistoryCard({
  currencyCode,
  emptyLabel,
  mode,
  onSelectMode,
  onSelectPoint,
  points,
  selectedChangeMinor,
  selectedPoint,
}: StatsBalanceHistoryCardProps) {
  const [chartWidth, setChartWidth] = useState(0);
  const [dismissedEventPointId, setDismissedEventPointId] = useState<string | null>(null);
  const chartModel = useMemo(
    () => getStatsBalanceHistoryChartModel({
      points,
      selectedPointId: selectedPoint?.id,
    }),
    [points, selectedPoint?.id],
  );
  const axisLabels = useMemo(() => getStatsBalanceHistoryAxisLabels(points), [points]);
  const selectedEvent = selectedPoint?.event;
  const showSelectedEventDetail = !!selectedEvent && dismissedEventPointId !== selectedPoint?.id;
  const handleChartLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setChartWidth((currentWidth) => (Math.abs(currentWidth - nextWidth) < 1 ? currentWidth : nextWidth));
  }, []);
  useEffect(() => {
    setDismissedEventPointId(null);
  }, [mode, points]);
  const selectNearestPoint = useCallback((event: GestureResponderEvent) => {
    const width = chartWidth || STATS_BALANCE_HISTORY_CHART_WIDTH;
    const eventMarker = chartModel
      ? getStatsBalanceHistoryEventMarkerAtPosition({
        chartWidth: width,
        markers: chartModel.eventMarkers,
        x: event.nativeEvent.locationX,
        y: event.nativeEvent.locationY,
      })
      : undefined;

    if (eventMarker) {
      setDismissedEventPointId(null);
      onSelectPoint(eventMarker.point.id ?? eventMarker.point.date);
      return;
    }

    const index = getStatsBalanceHistoryPointIndexAtX({
      pointCount: points.length,
      width,
      x: event.nativeEvent.locationX,
    });
    const point = points[index];

    if (point) {
      setDismissedEventPointId(null);
      onSelectPoint(point.id);
    }
  }, [chartModel, chartWidth, onSelectPoint, points]);
  const changeTone = getNetTone(selectedChangeMinor);
  const selectedCopy = getSelectedPointCopy(selectedPoint);

  return (
    <Card testID="stats-balance-history-card">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Balance history</Text>
          <Text style={styles.subtitle}>{getModeSubtitle(mode)}</Text>
        </View>
      </View>

      <View accessibilityLabel="Balance history mode" style={styles.modeSwitch} testID="stats-balance-mode-row">
        {balanceHistoryModeOptions.map((option) => {
          const selected = mode === option.id;

          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onSelectMode(option.id)}
              style={({ pressed }) => [
                styles.modeOption,
                selected && styles.modeOptionSelected,
                pressed && styles.pressed,
              ]}
              testID={`stats-balance-mode-${option.id}`}
            >
              <Text style={[styles.modeOptionText, selected && styles.modeOptionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedPoint && chartModel ? (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryMain}>
              <Text style={styles.balanceLabel}>{selectedCopy.balanceLabel}</Text>
              <Text numberOfLines={1} adjustsFontSizeToFit style={styles.balanceValue} testID="stats-balance-selected-balance">
                {formatMoney(selectedPoint.balanceMinor, currencyCode)}
              </Text>
              <Text numberOfLines={1} style={styles.summaryDate} testID="stats-balance-selected-date">
                {selectedCopy.dateLabel}
              </Text>
            </View>
            <View style={styles.changeBox}>
              <Text style={styles.changeLabel}>{selectedCopy.changeLabel}</Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.changeValue,
                  changeTone === 'income' && styles.incomeText,
                  changeTone === 'expense' && styles.expenseText,
                ]}
                testID="stats-balance-selected-change"
              >
                {formatSignedMoney(selectedChangeMinor, currencyCode)}
              </Text>
            </View>
          </View>

          <View
            accessibilityLabel={`${formatLongDateLabel(selectedPoint.date)}, ${formatMoney(selectedPoint.balanceMinor, currencyCode)}`}
            accessibilityRole="adjustable"
            onLayout={handleChartLayout}
            onMoveShouldSetResponder={() => points.length > 0}
            onResponderGrant={selectNearestPoint}
            onResponderMove={selectNearestPoint}
            onStartShouldSetResponder={() => points.length > 0}
            style={styles.chartTouchArea}
            testID="stats-balance-history-chart"
          >
            <Svg
              pointerEvents="none"
              width="100%"
              height={STATS_BALANCE_HISTORY_CHART_HEIGHT}
              viewBox={`0 0 ${STATS_BALANCE_HISTORY_CHART_WIDTH} ${STATS_BALANCE_HISTORY_CHART_HEIGHT}`}
            >
              {chartModel.zeroY !== undefined ? (
                <Line
                  x1={0}
                  x2={STATS_BALANCE_HISTORY_CHART_WIDTH}
                  y1={chartModel.zeroY}
                  y2={chartModel.zeroY}
                  stroke={colors.faint}
                  strokeDasharray="5 5"
                  strokeWidth={1}
                />
              ) : null}
              {chartModel.areaPath ? <Path d={chartModel.areaPath} fill={colors.primary} opacity={0.1} /> : null}
              {chartModel.todayDividerX !== undefined ? (
                <>
                  <Line
                    x1={chartModel.todayDividerX}
                    x2={chartModel.todayDividerX}
                    y1={6}
                    y2={STATS_BALANCE_HISTORY_CHART_HEIGHT - 6}
                    stroke={colors.muted}
                    strokeDasharray="4 5"
                    strokeWidth={1}
                  />
                  <SvgText
                    fill={colors.muted}
                    fontSize={10}
                    fontWeight="800"
                    textAnchor={chartModel.todayDividerX > STATS_BALANCE_HISTORY_CHART_WIDTH - 42 ? 'end' : 'start'}
                    x={Math.min(STATS_BALANCE_HISTORY_CHART_WIDTH - 4, chartModel.todayDividerX + 4)}
                    y={14}
                  >
                    Today
                  </SvgText>
                </>
              ) : null}
              {chartModel.historyLinePoints ? (
                <Polyline
                  fill="none"
                  points={chartModel.historyLinePoints}
                  stroke={colors.primaryDark}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                />
              ) : null}
              {chartModel.forecastLinePoints ? (
                <Polyline
                  fill="none"
                  points={chartModel.forecastLinePoints}
                  stroke={colors.success}
                  strokeDasharray="6 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                />
              ) : null}
              {chartModel.eventMarkers.map((marker) => {
                const selected = marker.point.id === selectedPoint.id;

                return (
                  <Circle
                    key={marker.point.id}
                    accessibilityLabel={`${formatLongDateLabel(marker.event.date)} upcoming payment event`}
                    cx={marker.point.x}
                    cy={marker.point.y}
                    fill={selected ? colors.success : colors.surface}
                    r={selected ? selectedEventMarkerRadius : eventMarkerRadius}
                    stroke={colors.success}
                    strokeWidth={selected ? 2.5 : 2}
                    testID={`stats-balance-event-marker-${marker.point.id}`}
                  />
                );
              })}
              {chartModel.selectedChartPoint ? (
                <Circle
                  cx={chartModel.selectedChartPoint.x}
                  cy={chartModel.selectedChartPoint.y}
                  fill={colors.primaryDark}
                  r={5.5}
                  stroke={colors.surface}
                  strokeWidth={2}
                />
              ) : null}
            </Svg>
          </View>

          <View style={styles.axisRow}>
            {axisLabels.map((label) => (
              <Text
                key={label.date}
                numberOfLines={1}
                style={[
                  styles.axisLabel,
                  label.align === 'center' && styles.axisLabelCenter,
                  label.align === 'right' && styles.axisLabelRight,
                ]}
              >
                {label.label}
              </Text>
            ))}
          </View>

          {selectedEvent && showSelectedEventDetail ? (
            <ForecastEventDetail
              currencyCode={currencyCode}
              event={selectedEvent}
              onDismiss={() => setDismissedEventPointId(selectedPoint.id)}
            />
          ) : null}
        </>
      ) : (
        <View style={styles.emptyState} testID="stats-balance-history-empty">
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        </View>
      )}
    </Card>
  );
});

function ForecastEventDetail({
  currencyCode,
  event,
  onDismiss,
}: {
  currencyCode: string;
  event: NonNullable<StatsBalanceHistoryDisplayPoint['event']>;
  onDismiss: () => void;
}) {
  const occurrenceCount = event.occurrences.length;
  const onlyOccurrence = occurrenceCount === 1 ? event.occurrences[0] : null;

  return (
    <View
      accessibilityLabel={`${formatLongDateLabel(event.date)} forecast event detail`}
      style={styles.eventDetail}
      testID="stats-balance-event-detail"
    >
      <View style={styles.eventDetailHeader}>
        <View style={styles.eventDetailHeaderText}>
          <Text style={styles.eventDate} testID="stats-balance-event-date">
            {formatLongDateLabel(event.date)}
          </Text>
          <Text numberOfLines={2} style={styles.eventTitle} testID="stats-balance-event-title">
            {onlyOccurrence ? onlyOccurrence.title : `${occurrenceCount} upcoming payments`}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Dismiss forecast event detail"
          accessibilityRole="button"
          onPress={onDismiss}
          style={({ pressed }) => [styles.eventDismissButton, pressed && styles.pressed]}
          testID="stats-balance-event-dismiss"
        >
          <Text style={styles.eventDismissText}>Close</Text>
        </Pressable>
      </View>

      <View style={styles.eventMetrics}>
        <View style={styles.eventMetric}>
          <Text style={styles.eventMetricLabel}>{onlyOccurrence ? 'Payment' : 'Net change'}</Text>
          <Text
            numberOfLines={1}
            style={[
              styles.eventMetricValue,
              getNetTone(event.netChangeMinor) === 'income' && styles.incomeText,
              getNetTone(event.netChangeMinor) === 'expense' && styles.expenseText,
            ]}
            testID="stats-balance-event-net-change"
          >
            {formatSignedMoney(event.netChangeMinor, currencyCode)} {currencyCode}
          </Text>
        </View>
        <View style={styles.eventMetric}>
          <Text style={styles.eventMetricLabel}>Projected balance</Text>
          <Text numberOfLines={1} style={styles.eventMetricValue} testID="stats-balance-event-projected-balance">
            {formatMoney(event.projectedBalanceMinor, currencyCode)}
          </Text>
        </View>
      </View>

      {occurrenceCount > 1 ? (
        <View style={styles.eventOccurrenceList} testID="stats-balance-event-occurrences">
          {event.occurrences.map((occurrence, index) => (
            <View
              key={`${occurrence.planId}:${occurrence.occurrenceIndex}:${index}`}
              style={styles.eventOccurrenceRow}
              testID={`stats-balance-event-occurrence-${index}`}
            >
              <Text numberOfLines={1} style={styles.eventOccurrenceTitle}>
                {occurrence.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.eventOccurrenceAmount,
                  getNetTone(occurrence.amountMinor) === 'income' && styles.incomeText,
                  getNetTone(occurrence.amountMinor) === 'expense' && styles.expenseText,
                ]}
              >
                {formatSignedMoney(occurrence.amountMinor, currencyCode)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  axisLabel: {
    color: colors.muted,
    flex: 1,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'left',
  },
  axisLabelCenter: {
    textAlign: 'center',
  },
  axisLabelRight: {
    textAlign: 'right',
  },
  axisRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  balanceValue: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: '900',
    minWidth: 140,
  },
  balanceLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  changeBox: {
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
    minWidth: 104,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  changeLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  changeValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  chartTouchArea: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: STATS_BALANCE_HISTORY_CHART_HEIGHT,
    overflow: 'hidden',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    minHeight: 148,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
    textAlign: 'center',
  },
  eventDate: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  eventDetail: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 10,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  eventDetailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  eventDetailHeaderText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  eventDismissButton: {
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  eventDismissText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  eventMetric: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 120,
  },
  eventMetricLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  eventMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  eventMetricValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  eventOccurrenceAmount: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  eventOccurrenceList: {
    gap: spacing.xs,
  },
  eventOccurrenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  eventOccurrenceTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '700',
    minWidth: 0,
  },
  eventTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  expenseText: {
    color: colors.danger,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  incomeText: {
    color: colors.success,
  },
  modeOption: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  modeOptionSelected: {
    backgroundColor: colors.primary,
  },
  modeOptionText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  modeOptionTextSelected: {
    color: colors.surface,
  },
  modeSwitch: {
    alignItems: 'stretch',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    padding: 2,
  },
  pressed: {
    opacity: 0.78,
  },
  subtitle: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  summaryDate: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: '700',
  },
  summaryMain: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  summaryRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  title: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
});

function getModeSubtitle(mode: StatsBalanceHistoryMode): string {
  switch (mode) {
    case 'history':
      return 'Historical account balance';
    case 'combined':
      return 'Actual balance with projected upcoming payments';
    case 'forecast':
      return 'Projected balance from upcoming payments';
  }
}

function getSelectedPointCopy(point?: StatsBalanceHistoryDisplayPoint): {
  balanceLabel: string;
  changeLabel: string;
  dateLabel: string;
} {
  if (!point) {
    return {
      balanceLabel: 'Balance',
      changeLabel: 'Change',
      dateLabel: '',
    };
  }

  if (point.kind === 'forecast') {
    return {
      balanceLabel: 'Projected balance',
      changeLabel: 'Projected',
      dateLabel: formatLongDateLabel(point.date),
    };
  }

  if (point.kind === 'today') {
    return {
      balanceLabel: 'Current balance',
      changeLabel: 'Today',
      dateLabel: `Today / ${formatLongDateLabel(point.date)}`,
    };
  }

  return {
    balanceLabel: 'Actual balance',
    changeLabel: 'Change',
    dateLabel: formatLongDateLabel(point.date),
  };
}
