import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { StatsTransactionAmountDistribution } from '../../../domain/statsTransactionAmountDistribution';
import { StatsTransactionAmountDistributionCard } from '../StatsTransactionAmountDistributionCard';

describe('StatsTransactionAmountDistributionCard', () => {
  it('renders all deterministic bucket labels and counts in one card', () => {
    const screen = renderCard(distribution);

    expect(screen.getAllByTestId('stats-transaction-amount-distribution-card')).toHaveLength(1);
    expect(screen.getByText('$0\u201310')).toBeTruthy();
    expect(screen.getByText('$10\u201325')).toBeTruthy();
    expect(screen.getByText('$25\u201350')).toBeTruthy();
    expect(screen.getByText('$50\u2013100')).toBeTruthy();
    expect(screen.getByText('$100\u2013250')).toBeTruthy();
    expect(screen.getByText('$250+')).toBeTruthy();
    expect(screen.getByTestId('stats-transaction-amount-bucket-count-0-10').props.children).toBe(4);
    expect(screen.getByTestId('stats-transaction-amount-bucket-count-10-25').props.children).toBe(2);
  });

  it('scales bars against the largest count and omits zero-count fill', () => {
    const screen = renderCard(distribution);
    const largestStyle = StyleSheet.flatten(
      screen.getByTestId('stats-transaction-amount-bucket-fill-0-10').props.style,
    );
    const halfStyle = StyleSheet.flatten(
      screen.getByTestId('stats-transaction-amount-bucket-fill-10-25').props.style,
    );

    expect(largestStyle.width).toBe('100%');
    expect(halfStyle.width).toBe('50%');
    expect(screen.queryByTestId('stats-transaction-amount-bucket-fill-25-50')).toBeNull();
  });

  it('keeps zero-count buckets visible for an empty distribution', () => {
    const screen = renderCard({
      ...distribution,
      totalCount: 0,
      buckets: distribution.buckets.map((bucket) => ({ ...bucket, count: 0 })),
    });

    expect(screen.getAllByText('0')).toHaveLength(6);
    expect(screen.queryByTestId('stats-transaction-amount-bucket-fill-0-10')).toBeNull();
  });

  it('keeps large counts constrained to a single readable value column', () => {
    const screen = renderCard({
      ...distribution,
      totalCount: 123456,
      buckets: distribution.buckets.map((bucket, index) => ({
        ...bucket,
        count: index === 0 ? 123456 : 0,
      })),
    });
    const count = screen.getByTestId('stats-transaction-amount-bucket-count-0-10');

    expect(count.props.numberOfLines).toBe(1);
    expect(count.props.adjustsFontSizeToFit).toBe(true);
    expect(StyleSheet.flatten(count.props.style).width).toBe(44);
  });
});

function renderCard(model: StatsTransactionAmountDistribution) {
  return render(React.createElement(StatsTransactionAmountDistributionCard, {
    distribution: model,
  }));
}

const distribution: StatsTransactionAmountDistribution = {
  currencyCode: 'AUD',
  reportKind: 'expense',
  totalCount: 6,
  buckets: [
    { id: '0-10', minMinor: 0, maxExclusiveMinor: 1000, count: 4 },
    { id: '10-25', minMinor: 1000, maxExclusiveMinor: 2500, count: 2 },
    { id: '25-50', minMinor: 2500, maxExclusiveMinor: 5000, count: 0 },
    { id: '50-100', minMinor: 5000, maxExclusiveMinor: 10000, count: 0 },
    { id: '100-250', minMinor: 10000, maxExclusiveMinor: 25000, count: 0 },
    { id: '250-plus', minMinor: 25000, maxExclusiveMinor: null, count: 0 },
  ],
};
