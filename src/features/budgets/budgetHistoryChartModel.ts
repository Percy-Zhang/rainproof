import type { BudgetHistoryPoint } from '../../domain/budgets';

export const BUDGET_HISTORY_PLOT_HEIGHT = 104;
export const BUDGET_HISTORY_LABEL_HEIGHT = 24;
export const BUDGET_HISTORY_LINE_WIDTH = 320;

type BudgetHistoryChartScaleOptions = {
  labelHeight?: number;
  plotHeight?: number;
};

export function getBudgetHistoryChartScale(
  points: BudgetHistoryPoint[],
  selectedPoint: BudgetHistoryPoint,
  options: BudgetHistoryChartScaleOptions = {},
) {
  const plotHeight = options.plotHeight ?? BUDGET_HISTORY_PLOT_HEIGHT;
  const labelHeight = options.labelHeight ?? BUDGET_HISTORY_LABEL_HEIGHT;
  const maximumSpent = Math.max(...points.map((point) => point.spentMinor), 0);
  const scaleMaximum = Math.max(selectedPoint.limitMinor * 1.15, maximumSpent * 1.08, 1);
  const limitHeight = Math.min(
    plotHeight - 1,
    Math.max(1, Math.round((selectedPoint.limitMinor / scaleMaximum) * plotHeight)),
  );

  return {
    scaleMaximum,
    limitHeight,
    limitBottom: labelHeight + limitHeight,
    getValueHeight(valueMinor: number): number {
      return Math.min(
        plotHeight - 1,
        Math.max(0, Math.round((Math.max(0, valueMinor) / scaleMaximum) * plotHeight)),
      );
    },
    getBarHeight(point: Pick<BudgetHistoryPoint, 'spentMinor'>): number {
      return point.spentMinor > 0
        ? Math.max(3, Math.round((point.spentMinor / scaleMaximum) * plotHeight))
        : 2;
    },
  };
}

export function shouldShowBudgetHistoryBarLabel({
  index,
  isSelected,
  pointCount,
}: {
  index: number;
  isSelected: boolean;
  pointCount: number;
}): boolean {
  if (isSelected || pointCount <= 8) {
    return true;
  }

  const lastIndex = pointCount - 1;
  if (index === 0 || index === lastIndex) {
    return true;
  }

  return index % Math.ceil(pointCount / 6) === 0;
}

export function getBudgetHistoryLineChartModel(
  points: BudgetHistoryPoint[],
  selectedPoint: BudgetHistoryPoint,
  options: BudgetHistoryChartScaleOptions & { width?: number } = {},
) {
  const width = options.width ?? BUDGET_HISTORY_LINE_WIDTH;
  const plotHeight = options.plotHeight ?? BUDGET_HISTORY_PLOT_HEIGHT;
  const scale = getBudgetHistoryChartScale(points, selectedPoint, { ...options, plotHeight, labelHeight: 0 });
  const divisor = Math.max(1, points.length - 1);
  const chartPoints = points.map((point, index) => {
    const x = (index / divisor) * width;
    const y = plotHeight - scale.getValueHeight(point.spentMinor);

    return { point, x, y };
  });
  const selectedChartPoint =
    chartPoints.find((chartPoint) => chartPoint.point.id === selectedPoint.id) ?? chartPoints.at(-1);

  return {
    chartPoints,
    limitY: plotHeight - scale.limitHeight,
    polylinePoints: chartPoints.map((point) => `${point.x},${point.y}`).join(' '),
    selectedChartPoint,
  };
}

export function getBudgetHistoryLineAxisLabels(points: BudgetHistoryPoint[]) {
  if (!points.length) {
    return [];
  }

  const lastIndex = points.length - 1;
  const indexes = Array.from(new Set([0, Math.floor(lastIndex / 2), lastIndex]));

  return indexes.map((index) => ({
    align: index === 0 ? 'left' as const : index === lastIndex ? 'right' as const : 'center' as const,
    index,
    label: points[index].shortLabel,
  }));
}
