import type { BudgetHistoryPoint } from '../../../domain/budgets';
import { calculateBudgetPercentUsed, calculateBudgetRemaining, getBudgetStatus } from '../../../domain/budgets';
import {
  BUDGET_HISTORY_LABEL_HEIGHT,
  getBudgetHistoryChartScale,
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
