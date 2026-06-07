import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render } from '@testing-library/react-native';

import { defaultCategories } from '../../../domain/categories';
import type { Account, AppSnapshot } from '../../../domain/types';
import { RecurringItemFormScreen } from '../RecurringItemFormScreen';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

describe('RecurringItemFormScreen account picker', () => {
  it('opens the dedicated picker and returns with the selected account currency and balance', () => {
    const screen = renderForm();

    expect(screen.getByText(/Everyday \/ AUD \/ .*10\.00/)).toBeTruthy();
    expect(screen.queryByText('Currency')).toBeNull();

    fireEvent.press(screen.getByTestId('recurring-account-row'));
    fireEvent.press(screen.getByText('Savings'));

    expect(screen.getByText(/Savings \/ USD \/ .*25\.00/)).toBeTruthy();
    expect(screen.queryByText('Currency')).toBeNull();
  });

  it('returns to the recurring form from the picker Back button', () => {
    const screen = renderForm();

    fireEvent.press(screen.getByTestId('recurring-account-row'));
    fireEvent.press(screen.getByText('Back'));

    expect(screen.getByTestId('recurring-account-row')).toBeTruthy();
  });
});

function renderForm() {
  return render(
    React.createElement(
      NavigationContainer,
      null,
      React.createElement(RecurringItemFormScreen, {
        mode: 'add',
        snapshot: snapshot(),
        onAddRecurringItem: jest.fn(async () => undefined),
        onOpenCategorySelect: jest.fn(),
        onCancel: jest.fn(),
        onDone: jest.fn(),
      }),
    ),
  );
}

function snapshot(): AppSnapshot {
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'manual',
      multiCurrencyEnabled: true,
      enabledCurrencyCodes: ['AUD', 'USD'],
      dashboardSelectedAccountIds: null,
    },
    categories: defaultCategories,
    accounts: [
      account('everyday', 'Everyday', 'AUD', 1000),
      account('savings', 'Savings', 'USD', 2500),
    ],
    transactions: [],
    transactionLines: [],
    transactionLinks: [],
    budgets: [],
    recurringItems: [],
    recurringBills: [],
    recurringTransactionHistory: [],
    transactionTemplates: [],
    rainyDayFund: {
      id: 'fund',
      name: 'Rainy day fund',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: '',
      updatedAt: '',
    },
  };
}

function account(
  id: string,
  name: string,
  currencyCode: string,
  openingBalanceMinor: number,
): Account {
  return {
    id,
    name,
    nickname: '',
    type: 'checking',
    currencyCode,
    openingBalanceMinor,
    creditLimitMinor: null,
    notes: '',
    institutionName: '',
    includeInRainyDay: false,
    themeColor: id === 'savings' ? '#2E7D59' : '#1876A8',
    iconName: 'wallet-outline',
    showOnDashboard: true,
    sortOrder: id === 'savings' ? 1 : 0,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
  };
}
