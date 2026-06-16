import type { BudgetHistoryPoint } from '../../../domain/budgets';
import { calculateBudgetPercentUsed, calculateBudgetRemaining, getBudgetStatus } from '../../../domain/budgets';
import {
  BUDGET_HISTORY_LABEL_HEIGHT,
  getBudgetHistoryLineAxisLabels,
  getBudgetHistoryLineChartModel,
  getBudgetHistoryChartScale,
  shouldShowBudgetHistoryBarLabel,
} from '../budgetHistoryChartModel';

describe('budget history chart scale', () => {
  it('scales calendar bars below, at, and above the budget limit against the same limit height', () => {
    const points = [
      makePoint('below', -2, 7500, 10000, 'May'),
      makePoint('at', -1, 10000, 10000, 'Jun'),
      makePoint('over', 0, 12500, 10000, 'Jul'),
    ];
    const scale = getBudgetHistoryChartScale(points, points[1]);

    expect(scale.getBarHeight(points[0])).toBeLessThan(scale.limitHeight);
    expect(scale.getBarHeight(points[1])).toBe(scale.limitHeight);
    expect(scale.getBarHeight(points[2])).toBeGreaterThan(scale.limitHeight);
    expect(scale.limitBottom).toBe(BUDGET_HISTORY_LABEL_HEIGHT + scale.limitHeight);
  });

  it('scales rolling bars below, at, and above the budget limit against the same limit height', () => {
    const points = [
      makePoint('rolling-below', -2, 4500, 6000, '7 Jun'),
      makePoint('rolling-at', -1, 6000, 6000, '8 Jun'),
      makePoint('rolling-over', 0, 7200, 6000, '9 Jun'),
    ];
    const scale = getBudgetHistoryChartScale(points, points[1]);

    expect(scale.getBarHeight(points[0])).toBeLessThan(scale.limitHeight);
    expect(scale.getBarHeight(points[1])).toBe(scale.limitHeight);
    expect(scale.getBarHeight(points[2])).toBeGreaterThan(scale.limitHeight);
    expect(scale.limitBottom).toBe(BUDGET_HISTORY_LABEL_HEIGHT + scale.limitHeight);
  });

  it('shows sparse labels for dense history while keeping selected labels visible', () => {
    const visibleIndexes = Array.from({ length: 12 }, (_, index) => index)
      .filter((index) => shouldShowBudgetHistoryBarLabel({
        index,
        isSelected: index === 5,
        pointCount: 12,
      }));

    expect(visibleIndexes).toEqual([0, 2, 4, 5, 6, 8, 10, 11]);
  });

  it('scales line points below, at, and above the budget limit against the same limit y-position', () => {
    const points = [
      makePoint('below', 0, 7500, 10000, '1 Jun'),
      makePoint('at', 1, 10000, 10000, '15 Jun'),
      makePoint('over', 2, 12500, 10000, '30 Jun'),
    ];
    const model = getBudgetHistoryLineChartModel(points, points[1]);

    expect(model.chartPoints[0].y).toBeGreaterThan(model.limitY);
    expect(model.chartPoints[1].y).toBe(model.limitY);
    expect(model.chartPoints[2].y).toBeLessThan(model.limitY);
    expect(model.selectedChartPoint?.point.id).toBe('at');
  });

  it('uses sparse line axis labels that are independent of point width', () => {
    const points = Array.from({ length: 30 }, (_, index) => (
      makePoint(`point-${index}`, index, index * 100, 10000, `${index + 1} Jun`)
    ));

    expect(getBudgetHistoryLineAxisLabels(points)).toEqual([
      { align: 'left', index: 0, label: '1 Jun' },
      { align: 'center', index: 14, label: '15 Jun' },
      { align: 'right', index: 29, label: '30 Jun' },
    ]);
  });
});

function makePoint(
  id: string,
  offset: number,
  spentMinor: number,
  limitMinor: number,
  shortLabel: string,
): BudgetHistoryPoint {
  const percentageUsed = calculateBudgetPercentUsed(limitMinor, spentMinor);

  return {
    id,
    offset,
    shortLabel,
    rangeLabel: shortLabel,
    range: {
      startIso: '2026-06-01T00:00:00.000Z',
      endIso: '2026-07-01T00:00:00.000Z',
    },
    limitMinor,
    spentMinor,
    remainingMinor: calculateBudgetRemaining(limitMinor, spentMinor),
    percentageUsed,
    status: getBudgetStatus(percentageUsed),
  };
}
