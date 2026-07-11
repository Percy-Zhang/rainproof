import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { StatsMonthlyTrendBucket, StatsMonthlyTrendSummary } from '../../../domain/statsTrends';
import { colors } from '../../../theme/tokens';
import { StatsMonthlyCashFlowChartCard } from '../StatsMonthlyCashFlowChartCard';

describe('StatsMonthlyCashFlowChartCard', () => {
  it('renders paired monthly bars on one shared scale and selects the latest month', () => {
    const screen = renderCard(summary);
    const largestBarStyle = StyleSheet.flatten(
      screen.getByTestId('monthly-cash-flow-spending-bar-2026-03').props.style,
    );
    const smallerBarStyle = StyleSheet.flatten(
      screen.getByTestId('monthly-cash-flow-income-bar-2026-02').props.style,
    );

    expect(screen.getAllByTestId('monthly-trend-card')).toHaveLength(1);
    expect(screen.getAllByTestId(/^monthly-cash-flow-income-bar-/)).toHaveLength(3);
    expect(screen.getAllByTestId(/^monthly-cash-flow-spending-bar-/)).toHaveLength(3);
    expect(largestBarStyle.height).toBeGreaterThan(smallerBarStyle.height);
    expect(screen.getByTestId('monthly-cash-flow-month-2026-03').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('monthly-cash-flow-selected-month').props.children).toBe('Mar 2026');
    expect(screen.getAllByTestId(/^monthly-cash-flow-year-label-/).map((label) => label.props.children)).toEqual([
      '2026',
    ]);
  });

  it('updates exact selected detail immediately when a month is tapped', () => {
    const screen = renderCard(summary);

    fireEvent.press(screen.getByTestId('monthly-cash-flow-month-2026-01'));

    expect(screen.getByTestId('monthly-cash-flow-month-2026-01').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('monthly-cash-flow-selected-month').props.children).toBe('Jan 2026');
    expect(screen.getByTestId('monthly-cash-flow-selected-income').props.children).toBe('$100.00');
    expect(screen.getByTestId('monthly-cash-flow-selected-spending').props.children).toBe('$120.00');
    expect(screen.getByTestId('monthly-cash-flow-selected-net').props.children).toBe('-$20.00');
    expect(StyleSheet.flatten(screen.getByTestId('monthly-cash-flow-selected-net').props.style).color).toBe(colors.danger);
  });

  it('resets stale selection to the latest month when bucket data changes', () => {
    const screen = renderCard(summary);
    fireEvent.press(screen.getByTestId('monthly-cash-flow-month-2026-01'));

    screen.rerender(React.createElement(MonthlyCashFlowChartHarness, {
      currencyCode: 'AUD',
      monthlyTrendSummary: {
        buckets: [
          bucket('2026-04', 4000, 1000),
          bucket('2026-05', 5000, 2000),
        ],
      },
    }));

    expect(screen.getByTestId('monthly-cash-flow-month-2026-05').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('monthly-cash-flow-selected-month').props.children).toBe('May 2026');
  });

  it('handles one-month, empty, and all-zero datasets', () => {
    const oneMonth = renderCard({ buckets: [bucket('2026-06', 5000, 0)] });
    expect(oneMonth.getAllByTestId(/^monthly-cash-flow-month-\d/)).toHaveLength(1);
    expect(oneMonth.getByTestId('monthly-cash-flow-selected-month').props.children).toBe('Jun 2026');
    oneMonth.unmount();

    const empty = renderCard({ buckets: [] });
    expect(empty.getByTestId('monthly-cash-flow-empty')).toBeTruthy();
    expect(empty.queryByTestId('monthly-cash-flow-chart-scroll')).toBeNull();
    empty.unmount();

    const allZero = renderCard({
      buckets: [bucket('2026-01', 0, 0), bucket('2026-02', 0, 0)],
    });
    expect(allZero.getByTestId('monthly-cash-flow-empty')).toBeTruthy();
    expect(allZero.queryByTestId('monthly-cash-flow-month-2026-01')).toBeNull();
  });

  it('shows full years only at boundaries in long horizontally scrollable ranges', () => {
    const buckets = Array.from({ length: 17 }, (_, index) => {
      const date = new Date(Date.UTC(2025, 10 + index, 1));
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      return bucket(monthKey, (index + 1) * 100, index * 80);
    });
    const screen = renderCard({ buckets });
    const year2026 = screen.getByTestId('monthly-cash-flow-year-label-2026-01');
    const year2027 = screen.getByTestId('monthly-cash-flow-year-label-2027-01');

    expect(screen.getByTestId('monthly-cash-flow-chart-scroll').props.horizontal).toBe(true);
    expect(screen.getAllByTestId(/^monthly-cash-flow-month-\d/)).toHaveLength(17);
    expect(screen.getAllByTestId(/^monthly-cash-flow-year-label-/).map((label) => label.props.children)).toEqual([
      '2025',
      '2026',
      '2027',
    ]);
    expect(year2026.props.numberOfLines).toBeUndefined();
    expect(year2026.props.ellipsizeMode).toBeUndefined();
    expect(year2027.props.numberOfLines).toBeUndefined();
    expect(year2027.props.ellipsizeMode).toBeUndefined();
    expect(screen.queryByText("Jan '26")).toBeNull();
    expect(screen.queryByText("Jan '27")).toBeNull();
  });
});

function renderCard(monthlyTrendSummary: StatsMonthlyTrendSummary) {
  return render(React.createElement(MonthlyCashFlowChartHarness, {
    currencyCode: 'AUD',
    monthlyTrendSummary,
  }));
}

function MonthlyCashFlowChartHarness({
  currencyCode,
  monthlyTrendSummary,
}: {
  currencyCode: string;
  monthlyTrendSummary: StatsMonthlyTrendSummary;
}) {
  const [selectedMonthKey, setSelectedMonthKey] = React.useState(
    monthlyTrendSummary.buckets.at(-1)?.monthKey ?? null,
  );
  const selectedMonthExists = monthlyTrendSummary.buckets.some(
    (bucket) => bucket.monthKey === selectedMonthKey,
  );
  const resolvedSelectedMonthKey = selectedMonthExists
    ? selectedMonthKey
    : monthlyTrendSummary.buckets.at(-1)?.monthKey ?? null;

  return React.createElement(StatsMonthlyCashFlowChartCard, {
    currencyCode,
    monthlyTrendSummary,
    onSelectMonth: setSelectedMonthKey,
    selectedMonthKey: resolvedSelectedMonthKey,
  });
}

const summary: StatsMonthlyTrendSummary = {
  buckets: [
    bucket('2026-01', 10000, 12000),
    bucket('2026-02', 20000, 5000),
    bucket('2026-03', 0, 30000),
  ],
};

function bucket(
  monthKey: string,
  incomeNetMinor: number,
  spendingNetMinor: number,
): StatsMonthlyTrendBucket {
  const [year, month] = monthKey.split('-').map(Number);
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return {
    monthKey,
    monthLabel,
    incomeNetMinor,
    spendingNetMinor,
    netCashFlowMinor: incomeNetMinor - spendingNetMinor,
  };
}
