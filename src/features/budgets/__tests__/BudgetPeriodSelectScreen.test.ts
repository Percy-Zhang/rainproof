import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { BudgetPeriodSelectScreen } from '../BudgetPeriodSelectScreen';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

describe('BudgetPeriodSelectScreen', () => {
  it('shows supported periods in calendar and rolling groups', () => {
    const screen = render(React.createElement(BudgetPeriodSelectScreen, {
      selectedPeriod: 'monthly',
      onBack: jest.fn(),
      onSelect: jest.fn(),
    }));

    expect(screen.getByText('Calendar periods')).toBeTruthy();
    expect(screen.getByText('Rolling periods')).toBeTruthy();
    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();
    expect(screen.getByText('Yearly')).toBeTruthy();
    expect(screen.getByText('Rolling 7 days')).toBeTruthy();
    expect(screen.getByText('Rolling 30 days')).toBeTruthy();
    expect(screen.getByText('Rolling 365 days')).toBeTruthy();
    expect(screen.queryByText('Quarterly')).toBeNull();
    expect(screen.queryByText('Rolling 90 days')).toBeNull();
    expect(screen.getByTestId('budget-period-option-monthly').props.accessibilityState.checked).toBe(true);
  });

  it('applies a selected period immediately and keeps back separate', () => {
    const onBack = jest.fn();
    const onSelect = jest.fn();
    const screen = render(React.createElement(BudgetPeriodSelectScreen, {
      selectedPeriod: 'weekly',
      onBack,
      onSelect,
    }));

    fireEvent.press(screen.getByTestId('budget-period-option-rolling_365'));
    expect(onSelect).toHaveBeenCalledWith('rolling_365');
    expect(onBack).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('cancel-budget-period-select'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
