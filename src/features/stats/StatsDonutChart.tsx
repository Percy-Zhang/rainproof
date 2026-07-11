import { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import { formatMoney } from '../../domain/money';
import type { StatsReportRollup } from '../../domain/statsReports';
import type { CurrencyCode } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type StatsDonutChartProps = {
  rollups: StatsReportRollup[];
  currencyCode: CurrencyCode;
  selectedRollupId?: string;
  onSelectRollup: (rollupId: string) => void;
  emptyLabel: string;
  accessibilityLabel?: string;
  totalLabel?: string;
};

const defaultChartSize = 220;
const maximumChartSize = 280;
const outerRadius = 104;
const selectedOuterRadius = 110;
const innerRadius = 66;
const fullCircleRadians = Math.PI * 2;
const slicePadAngle = 0.012;

type DonutSlice = {
  rollup: StatsReportRollup;
  startAngle: number;
  endAngle: number;
};

export function StatsDonutChart({
  accessibilityLabel = 'Select spending slice',
  rollups,
  currencyCode,
  selectedRollupId,
  onSelectRollup,
  emptyLabel,
  totalLabel = 'Total spending',
}: StatsDonutChartProps) {
  const positiveRollups = rollups.filter((rollup) => rollup.netAmountMinor > 0);
  const selectedRollup = selectedRollupId
    ? positiveRollups.find((rollup) => rollup.id === selectedRollupId)
    : undefined;
  const totalNetAmountMinor = positiveRollups.reduce((sum, rollup) => sum + rollup.netAmountMinor, 0);
  const slices = getDonutSlices(positiveRollups);
  const [containerWidth, setContainerWidth] = useState(0);
  const renderedChartSize = getResponsiveStatsDonutSize(containerWidth);
  const handleChartLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    setContainerWidth((currentWidth) => (
      Math.abs(currentWidth - nextWidth) < 1 ? currentWidth : nextWidth
    ));
  }, []);

  function handlePress(event: GestureResponderEvent) {
    const rollupId = getDonutSliceIdAtPoint({
      rollups: positiveRollups,
      size: renderedChartSize,
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    });

    if (rollupId) {
      onSelectRollup(rollupId);
    }
  }

  if (!positiveRollups.length) {
    return (
      <View style={styles.emptyChart}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View onLayout={handleChartLayout} style={styles.chartWrap}>
      <Pressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => [
          styles.chartPressable,
          { height: renderedChartSize, width: renderedChartSize },
          pressed && styles.pressed,
        ]}
        testID="stats-donut-chart"
      >
        <Svg
          pointerEvents="none"
          width={renderedChartSize}
          height={renderedChartSize}
          viewBox="-120 -120 240 240"
        >
          <G>
            {slices.map((slice) => {
              const isSelected = slice.rollup.id === selectedRollup?.id;
              const path = getArcPath(slice, isSelected);

              return path ? (
                <Path
                  key={slice.rollup.id}
                  d={path}
                  fill={slice.rollup.color}
                  opacity={!selectedRollup || isSelected ? 1 : 0.74}
                  stroke={colors.surface}
                  strokeWidth={isSelected ? 3 : 2}
                />
              ) : null;
            })}
            <Circle r={innerRadius - 4} fill={colors.surface} />
          </G>
        </Svg>
      </Pressable>
      <View pointerEvents="none" style={styles.centerLabel}>
        <Text numberOfLines={1} style={styles.centerKicker}>
          {selectedRollup?.label ?? totalLabel}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.centerAmount}>
          {formatMoney(selectedRollup?.netAmountMinor ?? totalNetAmountMinor, currencyCode)}
        </Text>
        <Text style={styles.centerPercent}>
          {selectedRollup ? formatPercentage(selectedRollup.percentage) : '100%'}
        </Text>
      </View>
    </View>
  );
}

export function getDonutSliceIdAtPoint({
  rollups,
  x,
  y,
  size = defaultChartSize,
  minimumRadius = (innerRadius - 14) * (size / defaultChartSize),
  maximumRadius = (selectedOuterRadius + 16) * (size / defaultChartSize),
}: {
  rollups: StatsReportRollup[];
  x: number;
  y: number;
  size?: number;
  minimumRadius?: number;
  maximumRadius?: number;
}): string | undefined {
  const center = size / 2;
  const dx = x - center;
  const dy = y - center;
  const radius = Math.sqrt(dx * dx + dy * dy);

  if (radius < minimumRadius || radius > maximumRadius) {
    return undefined;
  }

  const angle = normalizeDonutAngle(Math.atan2(dy, dx));
  return getDonutSlices(rollups).find((slice, index, slices) => {
    const isLast = index === slices.length - 1;
    return angle >= slice.startAngle && (angle < slice.endAngle || (isLast && angle <= slice.endAngle));
  })?.rollup.id;
}

export function getResponsiveStatsDonutSize(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) {
    return defaultChartSize;
  }

  if (containerWidth < 360) {
    return Math.min(defaultChartSize, containerWidth);
  }

  return Math.min(maximumChartSize, Math.max(defaultChartSize, Math.round(containerWidth / 2)));
}

export function getDonutSlices(rollups: StatsReportRollup[]): DonutSlice[] {
  const total = rollups.reduce((sum, rollup) => sum + rollup.netAmountMinor, 0);
  let cursor = -Math.PI / 2;

  if (total <= 0) {
    return [];
  }

  return rollups.map((rollup) => {
    const startAngle = cursor;
    const endAngle = cursor + (rollup.netAmountMinor / total) * fullCircleRadians;
    cursor = endAngle;

    return {
      rollup,
      startAngle,
      endAngle,
    };
  });
}

function normalizeDonutAngle(angle: number): number {
  return angle < -Math.PI / 2 ? angle + fullCircleRadians : angle;
}

function getArcPath(slice: DonutSlice, selected: boolean): string {
  const outer = selected ? selectedOuterRadius : outerRadius;
  const padded = getPaddedAngles(slice.startAngle, slice.endAngle);
  const startAngle = padded.startAngle;
  const endAngle = padded.endAngle;
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;
  const outerStart = polarToCartesian(outer, startAngle);
  const outerEnd = polarToCartesian(outer, endAngle);
  const innerEnd = polarToCartesian(innerRadius, endAngle);
  const innerStart = polarToCartesian(innerRadius, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outer} ${outer} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

function getPaddedAngles(startAngle: number, endAngle: number): { startAngle: number; endAngle: number } {
  const span = endAngle - startAngle;
  if (span >= fullCircleRadians - 0.0001) {
    return { startAngle, endAngle: startAngle + fullCircleRadians - 0.0001 };
  }

  if (span <= slicePadAngle * 2) {
    return { startAngle, endAngle };
  }

  return {
    startAngle: startAngle + slicePadAngle,
    endAngle: endAngle - slicePadAngle,
  };
}

function polarToCartesian(radius: number, angle: number): { x: string; y: string } {
  return {
    x: (Math.cos(angle) * radius).toFixed(3),
    y: (Math.sin(angle) * radius).toFixed(3),
  };
}

function formatPercentage(percentage: number): string {
  if (percentage >= 99.95) {
    return '100%';
  }

  if (percentage < 0.1 && percentage > 0) {
    return '<0.1%';
  }

  return `${percentage.toFixed(1)}%`;
}

const styles = StyleSheet.create({
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  chartPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabel: {
    alignItems: 'center',
    gap: 2,
    maxWidth: 120,
    position: 'absolute',
  },
  centerKicker: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerAmount: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
    textAlign: 'center',
    width: 116,
  },
  centerPercent: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  emptyChart: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 180,
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.94,
  },
});
