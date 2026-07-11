import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { BudgetHistoryPoint } from '../../../domain/budgets';
import { BudgetHistoryChart } from '../BudgetHistoryChart';

describe('BudgetHistoryChart responsive line chart', () => {
  it('uses the measured tablet width for the SVG and selected marker', () => {
    const points = [
      point('first', 0, 5000),
      point('middle', 1, 7500),
      point('last', 2, 10000),
    ];
    const screen = render(React.createElement(BudgetHistoryChart, {
      accentColor: '#336699',
      currencyCode: 'AUD',
      points,
      variant: 'line',
    }));

    fireEvent(screen.getByTestId('budget-history-line-chart'), 'layout', {
      nativeEvent: { layout: { height: 104, width: 768, x: 0, y: 0 } },
    });

    expect(screen.getByTestId('budget-history-line-svg').props.vbWidth).toBe(768);
    expect(screen.getByTestId('budget-history-line-svg').props.vbHeight).toBe(104);
    expect(screen.getByTestId('budget-history-selected-chart-point').props.cx).toBe(768);

    fireEvent.press(screen.getByTestId('budget-history-line-chart'), {
      nativeEvent: { locationX: 384 },
    });

    expect(screen.getByTestId('budget-history-selected-chart-point').props.cx).toBe(384);
  });
});

function point(id: string, offset: number, spentMinor: number): BudgetHistoryPoint {
  return {
    id,
    limitMinor: 10000,
    offset,
    percentageUsed: spentMinor / 100,
    range: {
      endIso: '2026-07-01T00:00:00.000Z',
      startIso: '2026-06-01T00:00:00.000Z',
    },
    rangeLabel: id,
    remainingMinor: 10000 - spentMinor,
    shortLabel: id,
    spentMinor,
    status: spentMinor >= 10000 ? 'over_budget' : 'under_budget',
  };
}
