import React from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';

import { defaultCategories } from '../../../domain/categories';
import type { Account, AppSnapshot, Transaction, TransactionLine, TransactionLink } from '../../../domain/types';
import { ExpenseLinkManager } from '../ExpenseLinkManager';
import { IncomeLinkManager } from '../IncomeLinkManager';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

describe('transaction link managers', () => {
  let animationFrames: FrameRequestCallback[];

  beforeEach(() => {
    animationFrames = [];
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens on a lightweight overview without candidate discovery or a visible reason selector', () => {
    const snapshot = makeSnapshot();
    const screen = renderExpenseManager(snapshot);

    expect(screen.getByText('Links overview')).toBeTruthy();
    expect(screen.getByText('Payments received')).toBeTruthy();
    expect(screen.getByText('Add payment')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Search transactions')).toBeNull();
    expect(screen.queryByText('Refund')).toBeNull();
    expect(screen.queryByText('Reimbursement')).toBeNull();
    expect(animationFrames).toHaveLength(0);

    fireEvent.press(screen.getByText('Add payment'));
    fireEvent.press(screen.getByLabelText('Back to links overview'));
    expect(screen.getByText('Links overview')).toBeTruthy();
    expect(screen.queryByPlaceholderText('Search transactions')).toBeNull();
  });

  it('shows the find shell immediately, keeps filter state immediate, and edits a new draft in a focused editor', () => {
    const snapshot = makeSnapshot();
    const screen = renderExpenseManager(snapshot);

    fireEvent.press(screen.getByText('Add payment'));
    expect(screen.getByText('Find transaction')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search transactions')).toBeTruthy();
    expect(screen.queryByText('Alice payment')).toBeNull();

    fireEvent.changeText(screen.getByPlaceholderText('Search transactions'), 'ali');
    expect(screen.getByDisplayValue('ali')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Search transactions'), '');

    fireEvent.press(screen.getByText('Partial'));
    expect(screen.getByRole('button', { name: 'Partial' }).props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(screen.getByText('All'));
    fireEvent.press(screen.getByText('Open'));
    expect(screen.getByRole('button', { name: 'Open' }).props.accessibilityState).toEqual({ selected: true });

    flushAnimationFrames(animationFrames);
    fireEvent.press(screen.getByText('Alice payment'));
    expect(screen.getByText('Allocation')).toBeTruthy();
    expect(screen.getByDisplayValue('55.00')).toBeTruthy();
    expect(screen.queryByText('Remove')).toBeNull();

    fireEvent.changeText(screen.getByDisplayValue('55.00'), '30.00');
    fireEvent.press(screen.getByText('Done'));
    expect(screen.getByText('Partial · 1 payment')).toBeTruthy();
    expect(screen.getAllByText('$25.00').length).toBeGreaterThan(0);
  });

  it('edits and removes a persisted allocation with bottom-row actions and restores capacity immediately', () => {
    const snapshot = makeSnapshot();
    snapshot.transactionLinks = [link({ amountMinor: 3000 })];
    const screen = renderExpenseManager(snapshot);

    fireEvent.press(screen.getByTestId('link-relationship-link'));
    const actions = within(screen.getByTestId('link-allocation-actions'));
    expect(actions.getByText('Use available')).toBeTruthy();
    expect(actions.getByText('Remove')).toBeTruthy();
    fireEvent.changeText(screen.getByDisplayValue('30.00'), '20.00');
    fireEvent.press(screen.getByText('Remove'));

    expect(screen.getByText('Open')).toBeTruthy();
    expect(screen.getAllByText('Unlinked').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$55.00').length).toBeGreaterThan(0);
  });

  it('uses source terminology and keeps relationship direction on a separate line', () => {
    const snapshot = makeSnapshot();
    snapshot.transactionLinks = [link({ amountMinor: 3000 })];
    const screen = renderIncomeManager(snapshot);

    expect(screen.getByText('Received')).toBeTruthy();
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByText('Used for · 1')).toBeTruthy();
    expect(screen.getByText('Used for Dinner with friends')).toBeTruthy();
  });

  it('renders whole scope first and split groups in authoritative parent-line order regardless of link order', () => {
    const snapshot = makeSplitSnapshot();
    const screen = renderExpenseManager(snapshot, 'split-expense');
    const groups = screen.getAllByTestId(/^link-scope-/).map((node) => node.props.testID);

    expect(groups).toEqual([
      'link-scope-target:whole',
      'link-scope-target:line-a',
      'link-scope-target:line-b',
      'link-scope-target:line-c',
    ]);
    expect(screen.getAllByText('Linked $20.00 · $10.00 left')).toHaveLength(1);
    expect(screen.getByText('Settled')).toBeTruthy();
    expect(screen.getAllByText('Unlinked').length).toBeGreaterThan(0);

    fireEvent.press(screen.getByText('A'));
    fireEvent.press(screen.getByText('B'));
    expect(screen.getByTestId('link-relationship-link-a-1')).toBeTruthy();
    expect(screen.getByTestId('link-relationship-link-a-2')).toBeTruthy();
    expect(screen.getByTestId('link-relationship-link-b-1')).toBeTruthy();
    expect(screen.getByTestId('link-relationship-link-b-2')).toBeTruthy();
  });
});

function flushAnimationFrames(frames: FrameRequestCallback[]) {
  act(() => {
    while (frames.length) {
      const current = frames.splice(0);
      current.forEach((callback) => callback(0));
    }
  });
}

function renderExpenseManager(snapshot: AppSnapshot, transactionId = 'expense') {
  return render(React.createElement(ExpenseLinkManager, {
    snapshot,
    transaction: snapshot.transactions.find((item) => item.id === transactionId)!,
    onSaveTransactionLinkBatch: jest.fn().mockResolvedValue(undefined),
    onDone: jest.fn(),
    onError: jest.fn(),
  }));
}

function renderIncomeManager(snapshot: AppSnapshot) {
  return render(React.createElement(IncomeLinkManager, {
    snapshot,
    transaction: snapshot.transactions.find((item) => item.id === 'income')!,
    onSaveTransactionLinkBatch: jest.fn().mockResolvedValue(undefined),
    onDone: jest.fn(),
    onError: jest.fn(),
  }));
}

function makeSnapshot(): AppSnapshot {
  const now = '2026-07-12T10:00:00.000Z';
  return baseSnapshot({
    transactions: [
      transaction('income', 'income', 'Alice payment', now),
      transaction('expense', 'expense', 'Dinner with friends', now),
    ],
    transactionLines: [
      line('income-line', 'income', 5500, { externalParty: 'Alice' }),
      line('expense-line', 'expense', -5500),
    ],
  });
}

function makeSplitSnapshot(): AppSnapshot {
  return baseSnapshot({
    transactions: [
      transaction('split-expense', 'expense', 'Weekend costs'),
      transaction('income-a', 'income', 'Alice payment', '2026-07-12T10:00:00.000Z'),
      transaction('income-a-2', 'income', 'Alex payment', '2026-07-11T10:00:00.000Z'),
      transaction('income-b', 'income', 'Bob payment', '2026-07-10T10:00:00.000Z'),
      transaction('income-b-2', 'income', 'Bea payment', '2026-07-09T10:00:00.000Z'),
    ],
    transactionLines: [
      line('line-a', 'split-expense', -3000, { note: 'A' }),
      line('line-b', 'split-expense', -2000, { note: 'B' }),
      line('line-c', 'split-expense', -1000, { note: 'C' }),
      line('income-a-line', 'income-a', 1000),
      line('income-a-2-line', 'income-a-2', 1000),
      line('income-b-line', 'income-b', 1000),
      line('income-b-2-line', 'income-b-2', 1000),
    ],
    transactionLinks: [
      link({ id: 'link-b-2', sourceTransactionId: 'income-b-2', targetTransactionId: 'split-expense', targetLineId: 'line-b', amountMinor: 1000 }),
      link({ id: 'link-a-2', sourceTransactionId: 'income-a-2', targetTransactionId: 'split-expense', targetLineId: 'line-a', amountMinor: 1000 }),
      link({ id: 'link-b-1', sourceTransactionId: 'income-b', targetTransactionId: 'split-expense', targetLineId: 'line-b', amountMinor: 1000 }),
      link({ id: 'link-a-1', sourceTransactionId: 'income-a', targetTransactionId: 'split-expense', targetLineId: 'line-a', amountMinor: 1000 }),
    ],
  });
}

function baseSnapshot(overrides: Partial<AppSnapshot>): AppSnapshot {
  const now = '2026-07-12T10:00:00.000Z';
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
      name: 'Rainy Day Fund',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: now,
      updatedAt: now,
    },
    ...overrides,
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
    themeColor: '',
    iconName: '',
    showOnDashboard: true,
    sortOrder: 0,
    isArchived: false,
    createdAt: '',
    updatedAt: '',
  };
}

function transaction(id: string, kind: Transaction['kind'], title: string, datetime = '2026-07-10T10:00:00.000Z'): Transaction {
  return { id, kind, title, datetime, notes: '', labels: [], groupId: '', createdAt: datetime, updatedAt: datetime };
}

function line(id: string, transactionId: string, amountMinor: number, overrides: Partial<TransactionLine> = {}): TransactionLine {
  return {
    id,
    transactionId,
    accountId: 'everyday',
    amountMinor,
    currencyCode: 'AUD',
    categoryId: amountMinor > 0 ? 'income' : 'food-dining',
    subcategoryId: amountMinor > 0 ? 'reimbursement' : 'restaurants',
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
    ...overrides,
  };
}

function link(overrides: Partial<TransactionLink> = {}): TransactionLink {
  return {
    id: 'link',
    sourceTransactionId: 'income',
    targetTransactionId: 'expense',
    sourceLineId: null,
    targetLineId: null,
    linkType: 'reimbursement',
    amountMinor: 3000,
    currencyCode: 'AUD',
    createdAt: '2026-07-12T10:00:00.000Z',
    updatedAt: '2026-07-12T10:00:00.000Z',
    ...overrides,
  };
}
