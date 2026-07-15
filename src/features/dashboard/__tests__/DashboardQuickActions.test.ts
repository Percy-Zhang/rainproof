import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import { DashboardScreen } from '../DashboardScreen';
import type {
  Account,
  AppSnapshot,
  RainyDayProgress,
  Transaction,
  TransactionLine,
} from '../../../domain/types';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

describe('Dashboard quick actions', () => {
  it('opens and closes the add action menu from the main dashboard button', async () => {
    const screen = renderDashboard();

    expect(screen.queryByTestId('dashboard-quick-action-menu')).toBeNull();

    fireEvent.press(screen.getByTestId('dashboard-add-transaction'));
    expect(screen.getByTestId('dashboard-quick-action-menu')).toBeTruthy();
    expect(screen.getByText('Add Transaction')).toBeTruthy();
    expect(screen.getByText('Use Template')).toBeTruthy();
    expect(screen.getAllByText(/Use Template|Add Transaction/).map((item) => item.props.children)).toEqual([
      'Use Template',
      'Add Transaction',
    ]);

    fireEvent.press(screen.getByTestId('dashboard-add-transaction'));
    await flushAnimationFrameCleanup();
    expect(screen.queryByTestId('dashboard-quick-action-menu')).toBeNull();
  });

  it('uses the existing add transaction navigation target and closes the menu', async () => {
    const onAddTransaction = jest.fn();
    const screen = renderDashboard({ onAddTransaction });

    fireEvent.press(screen.getByTestId('dashboard-add-transaction'));
    fireEvent.press(screen.getByTestId('dashboard-quick-action-add-transaction'));
    await flushAnimationFrameCleanup();

    expect(onAddTransaction).toHaveBeenCalledWith({ dashboardAccountIds: [] });
    expect(screen.queryByTestId('dashboard-quick-action-menu')).toBeNull();
  });

  it('passes the selected dashboard account context to Add Transaction', async () => {
    const onAddTransaction = jest.fn();
    const accounts = [account('bank'), account('wallet')];
    const screen = renderDashboard({
      accountBalances: accounts.map((item) => ({ account: item, balanceMinor: 1000 })),
      onAddTransaction,
      snapshot: snapshot(accounts),
    });

    fireEvent.press(screen.getByTestId('dashboard-add-transaction'));
    fireEvent.press(screen.getByTestId('dashboard-quick-action-add-transaction'));
    await flushAnimationFrameCleanup();

    expect(onAddTransaction).toHaveBeenCalledWith({ dashboardAccountIds: ['bank', 'wallet'] });
  });

  it('commits dashboard account selection immediately', async () => {
    const onUpdateSelectedAccountIds = jest.fn(async () => undefined);
    const accounts = [account('bank'), account('wallet')];
    const screen = renderDashboard({
      accountBalances: accounts.map((item) => ({ account: item, balanceMinor: 1000 })),
      onUpdateSelectedAccountIds,
      snapshot: snapshot(accounts),
    });

    fireEvent.press(screen.getByTestId('dashboard-account-wallet'));

    expect(onUpdateSelectedAccountIds).toHaveBeenCalledWith(['bank']);
    await flushAnimationFrameCleanup();
  });

  it('uses the latest intended dashboard account selection for rapid taps', async () => {
    const onUpdateSelectedAccountIds = jest.fn(async () => undefined);
    const accounts = [account('bank'), account('wallet'), account('savings')];
    const screen = renderDashboard({
      accountBalances: accounts.map((item) => ({ account: item, balanceMinor: 1000 })),
      onUpdateSelectedAccountIds,
      snapshot: snapshot(accounts),
    });

    fireEvent.press(screen.getByTestId('dashboard-account-wallet'));
    fireEvent.press(screen.getByTestId('dashboard-account-savings'));

    expect(onUpdateSelectedAccountIds).toHaveBeenNthCalledWith(1, ['bank', 'savings']);
    expect(onUpdateSelectedAccountIds).toHaveBeenNthCalledWith(2, ['bank']);
    await flushAnimationFrameCleanup();
  });

  it('updates dashboard recent transactions from the committed account filter without waiting for staged cards', async () => {
    const accounts = [account('bank'), account('wallet')];
    const transactions = [
      transaction('wallet-tx', 'Wallet coffee', '2026-05-28T10:00:00.000Z'),
      transaction('bank-tx', 'Bank rent', '2026-05-28T09:00:00.000Z'),
    ];
    const transactionLines = [
      transactionLine('wallet-line', 'wallet-tx', 'wallet'),
      transactionLine('bank-line', 'bank-tx', 'bank'),
    ];
    const screen = renderDashboard({
      accountBalances: accounts.map((item) => ({ account: item, balanceMinor: 1000 })),
      snapshot: snapshot(accounts, { transactionLines, transactions }),
    });

    expect(screen.getByTestId('dashboard-transaction-wallet-tx')).toBeTruthy();
    expect(screen.getByTestId('dashboard-transaction-bank-tx')).toBeTruthy();

    fireEvent.press(screen.getByTestId('dashboard-account-wallet'));

    expect(screen.queryByTestId('dashboard-transaction-wallet-tx')).toBeNull();
    expect(screen.getByTestId('dashboard-transaction-bank-tx')).toBeTruthy();
    await flushAnimationFrameCleanup();
  });

  it('opens Templates from the Use Template action and closes the menu', async () => {
    const onOpenTemplates = jest.fn();
    const screen = renderDashboard({ onOpenTemplates });

    fireEvent.press(screen.getByTestId('dashboard-add-transaction'));
    fireEvent.press(screen.getByTestId('dashboard-quick-action-use-template'));
    await flushAnimationFrameCleanup();

    expect(onOpenTemplates).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('dashboard-quick-action-menu')).toBeNull();
  });
});

function renderDashboard(overrides: Partial<DashboardProps> = {}) {
  const props: DashboardProps = {
    snapshot: snapshot(),
    accountBalances: [],
    rainyDayProgress: rainyDayProgress(),
    onAddAccount: jest.fn(),
    onAddTransaction: jest.fn(),
    onOpenRainyDayFund: jest.fn(),
    onOpenTransactions: jest.fn(),
    onOpenTransaction: jest.fn(),
    onOpenAccount: jest.fn(),
    onOpenBudgets: jest.fn(),
    onOpenDashboardEdit: jest.fn(),
    onOpenRecurring: jest.fn(),
    onOpenTemplates: jest.fn(),
    onUpdateSelectedAccountIds: jest.fn(async () => undefined),
    ...overrides,
  };

  return render(React.createElement(DashboardScreen, props));
}

async function flushAnimationFrameCleanup() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

type DashboardProps = Parameters<typeof DashboardScreen>[0];

function snapshot(accounts: Account[] = [], overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  const now = '2026-05-28T00:00:00.000Z';
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'auto',
      multiCurrencyEnabled: false,
      enabledCurrencyCodes: ['AUD'],
      dashboardSelectedAccountIds: null,
    },
    categories: [],
    accounts,
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
      goalMinor: 100000,
      linkedAccountIds: [],
      createdAt: now,
      updatedAt: now,
    },
    ...overrides,
  };
}

function rainyDayProgress(): RainyDayProgress {
  return {
    fund: snapshot().rainyDayFund,
    currentMinor: 0,
    remainingMinor: 100000,
    percentage: 0,
  };
}

function account(id: string): Account {
  return {
    id,
    name: id,
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

function transaction(id: string, title: string, datetime: string): Transaction {
  return {
    id,
    kind: 'expense',
    title,
    datetime,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: datetime,
    updatedAt: datetime,
  };
}

function transactionLine(id: string, transactionId: string, accountId: string): TransactionLine {
  return {
    id,
    transactionId,
    accountId,
    amountMinor: -1000,
    currencyCode: 'AUD',
    categoryId: 'general',
    subcategoryId: 'general',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '2026-05-28T00:00:00.000Z',
  };
}
