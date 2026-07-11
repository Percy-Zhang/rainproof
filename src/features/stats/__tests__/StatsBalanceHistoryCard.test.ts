import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { StatsBalanceHistoryCard } from '../StatsBalanceHistoryCard';
import type { StatsBalanceHistoryDisplayPoint } from '../statsBalanceHistory';

describe('StatsBalanceHistoryCard responsive chart', () => {
  it('uses the measured tablet width for the SVG and selected marker', () => {
    const points = [
      point('2026-07-01', 1000),
      point('2026-07-02', 2000),
      point('2026-07-03', 3000),
    ];
    const screen = render(React.createElement(StatsBalanceHistoryCard, {
      currencyCode: 'AUD',
      emptyLabel: 'No history',
      mode: 'history',
      onSelectMode: jest.fn(),
      onSelectPoint: jest.fn(),
      points,
      selectedChangeMinor: 1000,
      selectedPoint: points[1],
    }));

    fireEvent(screen.getByTestId('stats-balance-history-chart'), 'layout', {
      nativeEvent: { layout: { height: 160, width: 768, x: 0, y: 0 } },
    });

    expect(screen.getByTestId('stats-balance-history-svg').props.vbWidth).toBe(768);
    expect(screen.getByTestId('stats-balance-history-svg').props.vbHeight).toBe(136);
    expect(screen.getByTestId('stats-balance-selected-chart-point').props.cx).toBe(384);
    expect(screen.getByText('Combined').props.numberOfLines).toBe(1);
    expect(screen.getByText('Combined').props.adjustsFontSizeToFit).toBe(true);
  });
});

function point(date: string, balanceMinor: number): StatsBalanceHistoryDisplayPoint {
  return {
    balanceMinor,
    date,
    id: `history:${date}`,
    kind: 'history',
  };
}
