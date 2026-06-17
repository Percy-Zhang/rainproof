import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { defaultCategories } from '../../../domain/categories';
import type { Account, AppSnapshot, Budget } from '../../../domain/types';
import { BudgetsScreen } from '../BudgetsScreen';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

jest.mock('react-native-draggable-flatlist', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    __esModule: true,
    default: function MockDraggableFlatList(props: any) {
      return React.createElement(
        View,
        { style: props.containerStyle, testID: 'budgets-draggable-list' },
        props.ListHeaderComponent
          ? React.createElement(View, { testID: 'unexpected-list-header' }, props.ListHeaderComponent)
          : null,
        props.data.length
          ? props.data.map((item: any, index: number) => (
            React.createElement(
              View,
              { key: props.keyExtractor(item, index) },
              props.renderItem({
                drag: () => undefined,
                getIndex: () => index,
                isActive: false,
                item,
              }),
            )
          ))
          : props.ListEmptyComponent,
      );
    },
    ScaleDecorator: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock('../BudgetHistoryChart', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    BudgetHistoryChart: ({ variant }: { variant: 'bar' | 'line' }) => (
      React.createElement(Text, { testID: 'budget-history-chart' }, variant)
    ),
  };
});

describe('BudgetsScreen fixed controls', () => {
  it('keeps period controls outside the scroll list and preserves header actions', () => {
    const screen = renderBudgets();

    expect(screen.getByText('Budgets')).toBeTruthy();
    expect(screen.getByTestId('budget-period-previous')).toBeTruthy();
    expect(screen.getByTestId('budget-period-next')).toBeTruthy();
    expect(screen.getByTestId('budget-history-mode-current')).toBeTruthy();
    expect(screen.getByTestId('budget-history-mode-compare')).toBeTruthy();
    expect(screen.getByTestId('add-budget')).toBeTruthy();
    expect(screen.getByTestId('budgets-draggable-list').props.style).toEqual({ flex: 1 });
    expect(screen.queryByTestId('unexpected-list-header')).toBeNull();
  });

  it('switches expanded history from current line mode to compare bar mode', () => {
    const screen = renderBudgets();

    fireEvent.press(screen.getByTestId('budget-history-toggle-food'));
    expect(screen.getByTestId('budget-history-chart').props.children).toBe('line');

    fireEvent.press(screen.getByTestId('budget-history-mode-compare'));
    expect(screen.getByTestId('budget-history-chart').props.children).toBe('bar');
  });
});

function renderBudgets() {
  return render(React.createElement(BudgetsScreen, {
    snapshot: snapshot(),
    onAddBudget: jest.fn(),
    onEditBudget: jest.fn(),
    onUpdateBudgetOrder: jest.fn(async () => undefined),
  }));
}

function snapshot(): AppSnapshot {
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'manual',
      multiCurrencyEnabled: false,
      enabledCurrencyCodes: ['AUD'],
      dashboardSelectedAccountIds: null,
    },
    categories: defaultCategories,
    accounts: [account()],
    transactions: [],
    transactionLines: [],
    transactionLinks: [],
    budgets: [budget()],
    recurringItems: [],
    recurringBills: [],
    recurringTransactionHistory: [],
    transactionTemplates: [],
    rainyDayFund: {
      id: 'rainy-day',
      name: 'Rainy day fund',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

const now = '2026-06-16T00:00:00.000Z';

function account(): Account {
  return {
    id: 'checking',
    name: 'Everyday',
    nickname: '',
    type: 'checking',
    currencyCode: 'AUD',
    openingBalanceMinor: 0,
    creditLimitMinor: null,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
}

function budget(): Budget {
  return {
    id: 'food',
    name: 'Food',
    amountMinor: 10000,
    currencyCode: 'AUD',
    period: 'monthly',
    scopeType: 'overall',
    categoryId: null,
    subcategoryId: null,
    scopeItems: [],
    sortOrder: 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}
