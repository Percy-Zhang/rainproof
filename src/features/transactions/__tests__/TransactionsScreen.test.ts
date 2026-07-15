import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Keyboard, Platform } from 'react-native';

import { defaultCategories } from '../../../domain/categories';
import type { Account, AppSnapshot } from '../../../domain/types';
import {
  createDefaultTransactionPeriodState,
  TransactionsScreen,
} from '../TransactionsScreen';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

beforeAll(() => {
  globalThis.requestIdleCallback = jest.fn(() => 1);
  globalThis.cancelIdleCallback = jest.fn();
});

describe('TransactionsScreen interactions', () => {
  it('opens and closes the two Transactions quick actions from the main FAB', async () => {
    const screen = renderTransactionsScreen();
    const mainButton = screen.getByTestId('transactions-add-transaction');

    expect(mainButton.props.accessibilityState).toEqual({ expanded: false });
    expect(screen.getByLabelText('Open transaction quick actions')).toBeTruthy();
    expect(screen.queryByTestId('transactions-quick-action-menu')).toBeNull();
    expect(screen.queryByText('Add Transaction')).toBeNull();
    expect(screen.queryByText('Use Template')).toBeNull();

    fireEvent.press(mainButton);

    expect(screen.getByTestId('transactions-add-transaction').props.accessibilityState).toEqual({ expanded: true });
    expect(screen.getAllByLabelText('Close transaction quick actions')).toHaveLength(2);
    expect(screen.getByTestId('transactions-quick-action-menu')).toBeTruthy();
    expect(screen.getByText('Add Transaction')).toBeTruthy();
    expect(screen.getByText('Use Template')).toBeTruthy();
    expect(screen.getAllByText(/Add Transaction|Use Template/).map((item) => item.props.children)).toEqual([
      'Add Transaction',
      'Use Template',
    ]);

    fireEvent.press(screen.getByTestId('transactions-add-transaction'));
    await flushAnimationCompletion();

    expect(screen.getByTestId('transactions-add-transaction').props.accessibilityState).toEqual({ expanded: false });
    expect(screen.queryByTestId('transactions-quick-action-menu')).toBeNull();
  });

  it('uses the concise search placeholder and clears the entire query without hiding the field', () => {
    const screen = renderTransactionsScreen();
    const searchInput = screen.getByPlaceholderText('Search transactions');

    expect(screen.queryByLabelText('Clear transaction search')).toBeNull();

    fireEvent.changeText(searchInput, 'coffee shop');
    fireEvent.press(screen.getByLabelText('Clear transaction search'));

    expect(screen.getByPlaceholderText('Search transactions').props.value).toBe('');
    expect(screen.queryByLabelText('Clear transaction search')).toBeNull();

    fireEvent.changeText(screen.getByPlaceholderText('Search transactions'), 'tea');
    expect(screen.getByPlaceholderText('Search transactions').props.value).toBe('tea');
  });

  it('opens Add Transaction with the current Transactions account context', async () => {
    const onAddTransaction = jest.fn();
    const screen = renderTransactionsScreen({ onAddTransaction });

    fireEvent.press(screen.getByTestId('transactions-add-transaction'));
    fireEvent.press(screen.getByTestId('transactions-quick-action-add-transaction'));
    await flushAnimationCompletion();

    expect(onAddTransaction).toHaveBeenCalledWith({ dashboardAccountIds: ['everyday'] });
    expect(screen.getByTestId('transactions-add-transaction').props.accessibilityState).toEqual({ expanded: false });
    expect(screen.queryByTestId('transactions-quick-action-menu')).toBeNull();
  });

  it('opens the existing Templates flow and closes the quick actions', async () => {
    const onOpenTemplates = jest.fn();
    const screen = renderTransactionsScreen({ onOpenTemplates });

    fireEvent.press(screen.getByTestId('transactions-add-transaction'));
    fireEvent.press(screen.getByTestId('transactions-quick-action-use-template'));
    await flushAnimationCompletion();

    expect(onOpenTemplates).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('transactions-add-transaction').props.accessibilityState).toEqual({ expanded: false });
    expect(screen.queryByTestId('transactions-quick-action-menu')).toBeNull();
  });

  it('settles rapid main FAB taps on the latest requested state', async () => {
    const screen = renderTransactionsScreen();

    fireEvent.press(screen.getByTestId('transactions-add-transaction'));
    fireEvent.press(screen.getByTestId('transactions-add-transaction'));
    fireEvent.press(screen.getByTestId('transactions-add-transaction'));

    expect(screen.getByTestId('transactions-add-transaction').props.accessibilityState).toEqual({ expanded: true });
    expect(screen.getByTestId('transactions-quick-action-menu')).toBeTruthy();

    fireEvent.press(screen.getByTestId('transactions-add-transaction'));
    await flushAnimationCompletion();

    expect(screen.getByTestId('transactions-add-transaction').props.accessibilityState).toEqual({ expanded: false });
    expect(screen.queryByTestId('transactions-quick-action-menu')).toBeNull();
  });

  it('compacts accounts on downward scroll while keeping an active search visible', () => {
    const screen = renderTransactionsScreen();
    const searchInput = screen.getByPlaceholderText('Search transactions');

    fireEvent(searchInput, 'focus');
    fireEvent.changeText(searchInput, 'coffee');
    fireEvent(screen.getByTestId('transactions-section-list'), 'scrollBeginDrag', scrollEvent(0));
    fireEvent.scroll(screen.getByTestId('transactions-section-list'), scrollEvent(60));

    expect(screen.getAllByLabelText('Expand accounts')).toHaveLength(2);
    expect(screen.getByDisplayValue('coffee')).toBeTruthy();
  });

  it('compacts accounts while keeping search visible when the keyboard is open', () => {
    const keyboardListeners = new Map<string, Parameters<typeof Keyboard.addListener>[1]>();
    const addListener = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
      keyboardListeners.set(event, listener);
      return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
    });
    const screen = renderTransactionsScreen();
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';

    act(() => keyboardListeners.get(showEvent)?.({} as never));
    fireEvent(screen.getByTestId('transactions-section-list'), 'scrollBeginDrag', scrollEvent(0));
    fireEvent.scroll(screen.getByTestId('transactions-section-list'), scrollEvent(60));

    expect(screen.getAllByLabelText('Expand accounts')).toHaveLength(2);
    expect(screen.getByPlaceholderText('Search transactions')).toBeTruthy();
    addListener.mockRestore();
  });
});

async function flushAnimationCompletion() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

function renderTransactionsScreen({
  onAddTransaction = jest.fn(),
  onOpenTemplates = jest.fn(),
}: {
  onAddTransaction?: jest.Mock;
  onOpenTemplates?: jest.Mock;
} = {}) {
  return render(React.createElement(TransactionsScreen, {
    accountBalances: [],
    defaultSelectedAccountIds: ['everyday'],
    onAddTransaction,
    onOpenTransaction: jest.fn(),
    onOpenTemplates,
    onPeriodStateChange: jest.fn(),
    periodState: createDefaultTransactionPeriodState(),
    showHeader: false,
    snapshot: makeSnapshot(),
  }));
}

function scrollEvent(offsetY: number) {
  return {
    nativeEvent: {
      contentOffset: { x: 0, y: offsetY },
      contentSize: { height: 1000, width: 320 },
      layoutMeasurement: { height: 500, width: 320 },
    },
  };
}

function makeSnapshot(): AppSnapshot {
  const now = '2026-07-15T00:00:00.000Z';
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'manual',
      multiCurrencyEnabled: false,
      enabledCurrencyCodes: ['AUD'],
      dashboardSelectedAccountIds: ['everyday'],
    },
    categories: defaultCategories,
    accounts: [account('everyday')],
    transactions: [],
    transactionLines: [],
    transactionLinks: [],
    budgets: [],
    recurringItems: [],
    recurringBills: [],
    transactionTemplates: [],
    rainyDayFund: {
      id: 'fund',
      name: 'Rainy day fund',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}

function account(id: string): Account {
  return {
    id,
    name: 'Everyday',
    nickname: '',
    type: 'checking',
    currencyCode: 'AUD',
    openingBalanceMinor: 0,
    notes: '',
    institutionName: '',
    includeInRainyDay: true,
    themeColor: '#1876A8',
    iconName: 'business-outline',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
  };
}
