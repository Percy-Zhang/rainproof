import React from 'react';
import { fireEvent, render, within } from '@testing-library/react-native';

import type {
  StatsCashFlowWaterfall,
  StatsCashFlowWaterfallStep,
} from '../../../domain/statsCashFlowWaterfall';
import { StatsCashFlowWaterfallCard } from '../StatsCashFlowWaterfallCard';

describe('StatsCashFlowWaterfallCard', () => {
  it('renders deterministic steps inside one compact shared card', () => {
    const screen = renderCard(model);
    const cards = screen.getAllByTestId('stats-cash-flow-waterfall-card');
    const card = within(cards[0]);

    expect(cards).toHaveLength(1);
    expect(card.getAllByText(/^(Start|Income|Food & Dining|Transfers|End)$/).map((node) => node.props.children)).toEqual([
      'Start',
      'Income',
      'Food & Dining',
      'Transfers',
      'End',
    ]);
    expect(card.getByTestId('stats-cash-flow-step-amount-start').props.children).toBe('$100.00');
    expect(card.getByTestId('stats-cash-flow-step-amount-income').props.children).toBe('+$50.00');
    expect(card.getByTestId('stats-cash-flow-step-amount-expense:food').props.children).toBe('-$20.00');
    expect(card.getByTestId('stats-cash-flow-step-amount-end').props.children).toBe('$125.00');
    expect(card.getByTestId('stats-cash-flow-net-change').props.children).toEqual(['+$25.00', ' net']);
    expect(card.getByTestId('stats-cash-flow-step-track-income')).toBeTruthy();
  });

  it('opens only meaningful report-backed steps', () => {
    const onOpenStep = jest.fn();
    const screen = renderCard(model, onOpenStep);

    fireEvent.press(screen.getByTestId('stats-cash-flow-step-income'));
    fireEvent.press(screen.getByTestId('stats-cash-flow-step-expense:food'));
    fireEvent.press(screen.getByTestId('stats-cash-flow-step-transfers'));

    expect(onOpenStep).toHaveBeenNthCalledWith(1, expect.objectContaining({ id: 'income' }));
    expect(onOpenStep).toHaveBeenNthCalledWith(2, expect.objectContaining({ id: 'expense:food' }));
    expect(onOpenStep).toHaveBeenCalledTimes(2);
  });

  it('renders a concise empty state without eligible accounts', () => {
    const screen = renderCard({
      currencyCode: 'AUD',
      eligibleAccountIds: [],
      startingBalanceMinor: 0,
      endingBalanceMinor: 0,
      steps: [],
    });

    expect(screen.getByTestId('stats-cash-flow-waterfall-empty').props.children).toBe(
      'Select an account in this currency to see cash flow.',
    );
    expect(screen.queryByTestId('stats-cash-flow-step-start')).toBeNull();
  });
});

function renderCard(
  cashFlowModel: StatsCashFlowWaterfall,
  onOpenStep = jest.fn(),
) {
  return render(React.createElement(StatsCashFlowWaterfallCard, {
    model: cashFlowModel,
    onOpenStep,
  }));
}

const steps: StatsCashFlowWaterfallStep[] = [
  step('start', 'Start', 'start', 0, 10000, 10000),
  {
    ...step('income', 'Income', 'income', 5000, 10000, 15000),
    categoryId: 'income',
    drilldownReportKind: 'income',
  },
  {
    ...step('expense:food', 'Food & Dining', 'expense-category', -2000, 15000, 13000),
    categoryId: 'food',
    drilldownReportKind: 'expense',
  },
  step('transfers', 'Transfers', 'transfers', -500, 13000, 12500),
  step('end', 'End', 'end', 0, 12500, 12500),
];

const model: StatsCashFlowWaterfall = {
  currencyCode: 'AUD',
  eligibleAccountIds: ['checking'],
  startingBalanceMinor: 10000,
  endingBalanceMinor: 12500,
  steps,
};

function step(
  id: string,
  label: string,
  kind: StatsCashFlowWaterfallStep['kind'],
  deltaMinor: number,
  startBalanceMinor: number,
  endBalanceMinor: number,
): StatsCashFlowWaterfallStep {
  return {
    id,
    label,
    kind,
    deltaMinor,
    startBalanceMinor,
    endBalanceMinor,
  };
}
