import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { defaultCategories } from '../../../domain/categories';
import type { AppSnapshot, RecurringItem } from '../../../domain/types';
import { RecurringItemsScreen } from '../RecurringItemsScreen';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

describe('RecurringItemsScreen undo actions', () => {
  it('shows the newest undo action for generated recurring transactions', async () => {
    const onUndoRecurringTransaction = jest.fn(async () => undefined);
    const screen = render(React.createElement(RecurringItemsScreen, {
      snapshot: snapshot(true),
      onAddRecurringItem: jest.fn(),
      onCreateTransaction: jest.fn(),
      onEditRecurringItem: jest.fn(),
      onUndoRecurringTransaction,
    }));

    fireEvent.press(screen.getByTestId('undo-recurring-transaction-rent'));

    await waitFor(() => {
      expect(onUndoRecurringTransaction).toHaveBeenCalledWith('rent');
    });
    expect(screen.getByText('Undo last paid')).toBeTruthy();
  });

  it('hides undo when the recurring item has no generated transaction history', () => {
    const screen = render(React.createElement(RecurringItemsScreen, {
      snapshot: snapshot(false),
      onAddRecurringItem: jest.fn(),
      onCreateTransaction: jest.fn(),
      onEditRecurringItem: jest.fn(),
      onUndoRecurringTransaction: jest.fn(async () => undefined),
    }));

    expect(screen.queryByTestId('undo-recurring-transaction-rent')).toBeNull();
  });

  it('shows multiple generated payments as a newest-first undo stack', () => {
    const screen = render(React.createElement(RecurringItemsScreen, {
      snapshot: snapshot(true, 2),
      onAddRecurringItem: jest.fn(),
      onCreateTransaction: jest.fn(),
      onEditRecurringItem: jest.fn(),
      onUndoRecurringTransaction: jest.fn(async () => undefined),
    }));

    expect(screen.getByText('2 generated transactions can be undone, newest first.')).toBeTruthy();
    expect(screen.getByTestId('undo-recurring-transaction-rent')).toBeTruthy();
  });
});

function snapshot(withHistory: boolean, historyCount = 1): AppSnapshot {
  const item = recurringItem();

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
    accounts: [{
      id: 'everyday',
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
      createdAt: '',
      updatedAt: '',
    }],
    transactions: [],
    transactionLines: [],
    transactionLinks: [],
    budgets: [],
    recurringItems: [item],
    recurringBills: [item],
    recurringTransactionHistory: withHistory
      ? Array.from({ length: historyCount }, (_, index) => ({
        id: `history-${index + 1}`,
        recurringItemId: item.id,
        transactionId: `transaction-${index + 1}`,
        previousNextDueDate: index ? '2099-02-01' : '2099-01-01',
        advancedNextDueDate: index ? '2099-03-01' : '2099-02-01',
        sequence: index + 1,
        createdAt: `2026-06-0${index + 7}T00:00:00.000Z`,
      }))
      : [],
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

function recurringItem(): RecurringItem {
  return {
    id: 'rent',
    name: 'Rent',
    kind: 'expense',
    amountMinor: 200000,
    currencyCode: 'AUD',
    accountId: 'everyday',
    categoryId: 'housing',
    subcategoryId: 'rent',
    note: '',
    frequency: 'monthly',
    nextDueDate: '2099-02-01',
    isActive: true,
    createdAt: '',
    updatedAt: '',
  };
}
