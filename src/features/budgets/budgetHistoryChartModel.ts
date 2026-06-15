import type { BudgetHistoryPoint } from '../../domain/budgets';

export const BUDGET_HISTORY_PLOT_HEIGHT = 104;
export const BUDGET_HISTORY_LABEL_HEIGHT = 24;

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
    getBarHeight(point: Pick<BudgetHistoryPoint, 'spentMinor'>): number {
      return point.spentMinor > 0
        ? Math.max(3, Math.round((point.spentMinor / scaleMaximum) * plotHeight))
        : 2;
    },
  };
}
