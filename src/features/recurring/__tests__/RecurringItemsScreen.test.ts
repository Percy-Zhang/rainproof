import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { defaultCategories } from '../../../domain/categories';
import type { AppSnapshot, RecurringItem } from '../../../domain/types';
import { RecurringItemsScreen } from '../RecurringItemsScreen';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

describe('RecurringItemsScreen upcoming payment actions', () => {
  it('opens Add Transaction from an upcoming payment', () => {
    const onCreateTransaction = jest.fn();
    const screen = renderScreen({ onCreateTransaction });

    expect(screen.getByText('Mark paid')).toBeTruthy();
    fireEvent.press(screen.getByTestId('create-recurring-transaction-rent'));

    expect(onCreateTransaction).toHaveBeenCalledWith('rent');
    expect(screen.queryByTestId('undo-recurring-transaction-rent')).toBeNull();
  });

  it('drafts recurring due dates inline and saves only when confirmed', async () => {
    const onUpdateRecurringItem = jest.fn(async () => undefined);
    const screen = renderScreen({ onUpdateRecurringItem });

    fireEvent.press(screen.getByTestId('edit-recurring-item-rent'));
    expect(screen.getByText('Previous')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.queryByText('Mark paid')).toBeNull();

    fireEvent.press(screen.getByTestId('next-recurring-due-date-rent'));
    expect(screen.getByText('March 1, 2099')).toBeTruthy();
    expect(onUpdateRecurringItem).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('confirm-recurring-due-date-rent'));

    expect(screen.queryByText('Previous')).toBeNull();
    expect(screen.getByText('Mark paid')).toBeTruthy();
    expect(screen.getByText('March 1, 2099')).toBeTruthy();

    await waitFor(() => {
      expect(onUpdateRecurringItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'rent',
          nextDueDate: '2099-03-01',
          completedAt: null,
        }),
      );
    });
  });

  it('rolls back the optimistic due date if the save fails', async () => {
    const onUpdateRecurringItem = jest.fn(async () => {
      throw new Error('Could not save due date.');
    });
    const screen = renderScreen({ onUpdateRecurringItem });

    fireEvent.press(screen.getByTestId('edit-recurring-item-rent'));
    fireEvent.press(screen.getByTestId('next-recurring-due-date-rent'));
    fireEvent.press(screen.getByTestId('confirm-recurring-due-date-rent'));

    expect(screen.getByText('March 1, 2099')).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText('Could not save due date.')).toBeTruthy();
      expect(screen.getByText('February 1, 2099')).toBeTruthy();
    });
  });

  it('can preview several recurring due-date changes before confirming one save', async () => {
    const onUpdateRecurringItem = jest.fn(async () => undefined);
    const screen = renderScreen({ onUpdateRecurringItem });

    fireEvent.press(screen.getByTestId('edit-recurring-item-rent'));
    fireEvent.press(screen.getByTestId('next-recurring-due-date-rent'));
    fireEvent.press(screen.getByTestId('next-recurring-due-date-rent'));
    fireEvent.press(screen.getByTestId('previous-recurring-due-date-rent'));

    expect(screen.getByText('March 1, 2099')).toBeTruthy();
    expect(onUpdateRecurringItem).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('confirm-recurring-due-date-rent'));

    await waitFor(() => {
      expect(onUpdateRecurringItem).toHaveBeenCalledTimes(1);
      expect(onUpdateRecurringItem).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'rent',
          nextDueDate: '2099-03-01',
          completedAt: null,
        }),
      );
    });
  });

  it('does not show period movement controls for one-time plans', () => {
    const screen = renderScreen({
      snapshot: snapshot({
        frequency: 'one_time',
      }),
    });

    expect(screen.getByText('One-time')).toBeTruthy();
    expect(screen.queryByTestId('previous-recurring-due-date-rent')).toBeNull();
    expect(screen.queryByTestId('next-recurring-due-date-rent')).toBeNull();
  });

  it('opens the normal edit flow from the one-time row edit icon', () => {
    const onEditRecurringItem = jest.fn();
    const screen = renderScreen({
      onEditRecurringItem,
      snapshot: snapshot({
        frequency: 'one_time',
      }),
    });

    fireEvent.press(screen.getByTestId('edit-recurring-item-rent'));

    expect(onEditRecurringItem).toHaveBeenCalledWith('rent');
    expect(screen.queryByTestId('previous-recurring-due-date-rent')).toBeNull();
    expect(screen.queryByTestId('next-recurring-due-date-rent')).toBeNull();
  });

  it('renders the row edit action with a pencil icon', () => {
    const screen = renderScreen();

    expect(screen.UNSAFE_getByProps({ name: 'pencil-outline' })).toBeTruthy();
  });

  it('hides completed one-time plans from the active list', () => {
    const screen = renderScreen({
      snapshot: snapshot({
        frequency: 'one_time',
        completedAt: '2026-06-07T00:00:00.000Z',
      }),
    });

    expect(screen.queryByTestId('recurring-row-rent')).toBeNull();
    expect(screen.getByText('No active upcoming payments')).toBeTruthy();
  });
});

function renderScreen({
  onCreateTransaction = jest.fn(),
  onEditRecurringItem = jest.fn(),
  onUpdateRecurringItem = jest.fn(async () => undefined),
  snapshot: nextSnapshot = snapshot(),
}: {
  onCreateTransaction?: jest.Mock;
  onEditRecurringItem?: jest.Mock;
  onUpdateRecurringItem?: jest.Mock;
  snapshot?: AppSnapshot;
} = {}) {
  return render(React.createElement(RecurringItemsScreen, {
    snapshot: nextSnapshot,
    onAddRecurringItem: jest.fn(),
    onCreateTransaction,
    onEditRecurringItem,
    onUpdateRecurringItem,
  }));
}

function snapshot(itemOverrides: Partial<RecurringItem> = {}): AppSnapshot {
  const item = recurringItem(itemOverrides);

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

function recurringItem(overrides: Partial<RecurringItem> = {}): RecurringItem {
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
    completedAt: null,
    splitLines: [],
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}
