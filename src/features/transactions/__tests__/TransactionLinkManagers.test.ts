import React, { createRef } from 'react';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { Alert, BackHandler, FlatList, StyleSheet } from 'react-native';

import { defaultCategories } from '../../../domain/categories';
import * as candidateModel from '../../../domain/transactionLinkCandidateModel';
import type { Account, AppSnapshot, Transaction, TransactionLine, TransactionLink } from '../../../domain/types';
import { colors } from '../../../theme/tokens';
import { ExpenseLinkManager } from '../ExpenseLinkManager';
import { IncomeLinkManager } from '../IncomeLinkManager';
import { LinkTransactionScreen } from '../LinkTransactionScreen';
import type { TransactionLinkManagerHandle } from '../TransactionLinkFlowViews';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

describe('transaction link managers', () => {
  let animationFrames: FrameRequestCallback[];

  beforeEach(() => {
    jest.useFakeTimers();
    animationFrames = [];
    jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    jest.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('opens on a lightweight overview with contextual Link and no global save controls', () => {
    const screen = renderExpenseManager(makeSnapshot()).screen;

    expect(screen.getByText('Links')).toBeTruthy();
    expect(screen.getByText('Payments received')).toBeTruthy();
    expect(screen.getByText('Link')).toBeTruthy();
    expect(screen.queryByText('Add payment')).toBeNull();
    expect(screen.queryByText('Save links')).toBeNull();
    expect(screen.queryByPlaceholderText('Search transactions')).toBeNull();
    expect(animationFrames).toHaveLength(0);

    fireEvent.press(screen.getByText('Link'));
    expect(screen.getByText('Find transaction')).toBeTruthy();
    expect(screen.getByPlaceholderText('Search transactions')).toBeTruthy();
  });

  it('uses white overview cards with a full-card expansion target and one summary date', () => {
    const snapshot = makeSnapshot();
    snapshot.transactionLinks = [link({ amountMinor: 3000 })];
    const screen = renderExpenseManager(snapshot).screen;
    const group = screen.getByTestId('link-scope-target:whole');
    const toggle = screen.getByTestId('link-scope-target:whole-toggle');

    expect(StyleSheet.flatten(group.props.style).backgroundColor).toBe(colors.surface);
    expect(screen.getAllByTestId('links-overview-date')).toHaveLength(1);
    expect(toggle.props.accessibilityState).toEqual({ expanded: true });
    const parentSummary = within(screen.getByTestId('link-parent-summary'));
    expect(parentSummary.queryByText(/Linked/)).toBeNull();
    expect(parentSummary.queryByText(/Remaining/)).toBeNull();
    expect(screen.getByText('Allocated')).toBeTruthy();

    fireEvent.press(toggle);
    expect(screen.getByTestId('link-scope-target:whole-toggle').props.accessibilityState).toEqual({ expanded: false });
    fireEvent.press(screen.getByTestId('link-scope-target:whole-toggle'));
    expect(screen.getByTestId('link-scope-target:whole-toggle').props.accessibilityState).toEqual({ expanded: true });

    fireEvent.press(screen.getByText('Unlink'));
    expect(screen.getByTestId('link-scope-target:whole-toggle').props.accessibilityState).toEqual({ expanded: true });
  });

  it('keeps the Find context fixed above white scrolling candidates', () => {
    const screen = renderExpenseManager(makeSnapshot()).screen;

    fireEvent.press(screen.getByText('Link'));
    flushAnimationFrames(animationFrames);

    expect(screen.getByTestId('link-find-fixed-header')).toBeTruthy();
    expect(screen.getByTestId('link-find-results-scroll')).toBeTruthy();
    const sourceSummary = within(screen.getByTestId('link-find-source-summary'));
    expect(sourceSummary.getByText('Dinner with friends')).toBeTruthy();
    expect(sourceSummary.getByText('Jul 12')).toBeTruthy();
    expect(sourceSummary.getByText('Everyday')).toBeTruthy();
    expect(sourceSummary.getByText('Parent transaction')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('link-candidate-income-card').props.style).backgroundColor)
      .toBe(colors.surface);
  });

  it('keeps fixed Find controls outside a paginated FlatList and reveals one chronological page at a time', () => {
    const prepareSpy = jest.spyOn(candidateModel, 'prepareIncomeLinkSourceCandidateViews');
    const searchSpy = jest.spyOn(candidateModel, 'searchPreparedIncomeLinkSourceCandidateViews');
    const statusBucketSpy = jest.spyOn(candidateModel, 'getTransactionLinkCandidateStatusBuckets');
    const screen = renderExpenseManager(makePaginatedExpenseSnapshot()).screen;

    fireEvent.press(screen.getByText('Link'));
    expect(screen.getByLabelText('Preparing transaction results')).toBeTruthy();
    expect(screen.queryByText('Load more')).toBeNull();

    flushAnimationFrames(animationFrames);

    let results = screen.UNSAFE_getByType(FlatList);
    expect(results.props.data).toHaveLength(20);
    expect(results.props.data.map((candidate: { transaction: Transaction }) => candidate.transaction.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `income-${index}`),
    );
    expect(results.props.keyExtractor(results.props.data[0], 0)).toBe('income-0');
    expect(within(results).queryByTestId('link-find-source-summary')).toBeNull();
    expect(screen.getByTestId('link-find-source-summary')).toBeTruthy();
    expect(screen.queryByLabelText('Preparing transaction results')).toBeNull();
    const preparationCallCount = prepareSpy.mock.calls.length;
    const searchCallCount = searchSpy.mock.calls.length;
    const statusBucketCallCount = statusBucketSpy.mock.calls.length;
    const collapsedRow = results.props.renderItem({ item: results.props.data[0], index: 0, separators: {} });
    expect(collapsedRow.props.snapshot).toBeUndefined();
    expect(collapsedRow.props.children).toBeNull();
    expect(collapsedRow.props.candidate.presentation).toEqual(expect.objectContaining({
      accountName: 'Everyday',
      amountLabel: '+$10.00',
      dateLabel: 'Jul 31',
    }));
    expect(results.props.initialNumToRender).toBe(8);
    expect(results.props.maxToRenderPerBatch).toBe(8);

    act(() => {
      results.props.onEndReached();
      results.props.onEndReached();
    });
    results = screen.UNSAFE_getByType(FlatList);
    expect(results.props.data).toHaveLength(20);

    act(() => {
      results.props.onScrollBeginDrag();
      results.props.onEndReached();
      results.props.onEndReached();
    });
    results = screen.UNSAFE_getByType(FlatList);
    expect(results.props.data).toHaveLength(40);

    act(() => {
      results.props.onScrollBeginDrag();
      results.props.onEndReached();
    });
    expect(screen.UNSAFE_getByType(FlatList).props.data).toHaveLength(45);

    fireEvent.press(screen.getByRole('button', { name: 'Partial' }));
    fireEvent.press(screen.getByRole('button', { name: 'Settled' }));
    fireEvent.press(screen.getByRole('button', { name: 'All' }));
    results = screen.UNSAFE_getByType(FlatList);
    expect(results.props.data).toHaveLength(20);
    expect(screen.getByRole('button', { name: 'All' }).props.accessibilityState).toEqual({ selected: true });
    expect(prepareSpy).toHaveBeenCalledTimes(preparationCallCount);
    expect(searchSpy).toHaveBeenCalledTimes(searchCallCount);
    expect(statusBucketSpy).toHaveBeenCalledTimes(statusBucketCallCount);

    act(() => results.props.onEndReached());
    expect(screen.UNSAFE_getByType(FlatList).props.data).toHaveLength(20);

    act(() => {
      results.props.onScrollBeginDrag();
      results.props.onEndReached();
    });
    expect(screen.UNSAFE_getByType(FlatList).props.data).toHaveLength(40);
    fireEvent.changeText(screen.getByPlaceholderText('Search transactions'), 'Income');
    expect(screen.UNSAFE_getByType(FlatList).props.data).toHaveLength(20);
    expect(prepareSpy).toHaveBeenCalledTimes(preparationCallCount);
  });

  it('automatically uses the smaller endpoint remaining capacity', () => {
    const snapshot = makeSnapshot();
    snapshot.transactionLines = snapshot.transactionLines.map((item) =>
      item.id === 'income-line' ? { ...item, amountMinor: 9000 } : { ...item, amountMinor: -3000 });
    const { ref, screen } = renderExpenseManager(snapshot);

    fireEvent.press(screen.getByText('Link'));
    flushAnimationFrames(animationFrames);
    fireEvent.press(screen.getByText('Alice payment'));

    expect(screen.getByTestId('link-detail-amount').props.children).toBe('$30.00');
    fireEvent.press(screen.getByRole('button', { name: 'Link' }));
    expect(ref.current?.getDraftChanges().toAdd[0]).toEqual(expect.objectContaining({ amountMinor: 3000 }));
  });

  it('keeps filters immediate and accepts a new allocation only through Link', () => {
    const { ref, screen } = renderExpenseManager(makeSnapshot());

    fireEvent.press(screen.getByText('Link'));
    fireEvent.press(screen.getByText('Partial'));
    expect(screen.getByRole('button', { name: 'Partial' }).props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(screen.getByText('All'));
    flushAnimationFrames(animationFrames);

    fireEvent.press(screen.getByText('Alice payment'));
    expect(screen.getByText('Link transaction')).toBeTruthy();
    expect(screen.getByTestId('link-source-endpoint')).toBeTruthy();
    expect(screen.getByTestId('link-target-endpoint')).toBeTruthy();
    expect(screen.getByTestId('link-detail-amount').props.children).toBe('$55.00');
    expect(screen.queryByDisplayValue('55.00')).toBeNull();
    expect(screen.queryByText('Fill remaining')).toBeNull();

    expect(ref.current?.getDraftChanges().toAdd).toEqual([]);
    fireEvent.press(screen.getByRole('button', { name: 'Link' }));

    expect(screen.getByText('Links')).toBeTruthy();
    expect(ref.current?.getDraftChanges().toAdd).toEqual([
      expect.objectContaining({ sourceTransactionId: 'income', targetTransactionId: 'expense', amountMinor: 5500 }),
    ]);
  });

  it('leaves an existing link unchanged when its read-only detail is closed', () => {
    const snapshot = makeSnapshot();
    snapshot.transactionLinks = [link({ amountMinor: 3000 })];
    const onAccept = jest.fn();
    const onBack = jest.fn();
    const screen = render(React.createElement(LinkTransactionScreen, {
      snapshot,
      transactionId: 'expense',
      onAcceptTransactionLinkDraft: onAccept,
      onBack,
    }));

    fireEvent.press(screen.getByTestId('link-relationship-link'));
    expect(screen.getByText('Linked transaction')).toBeTruthy();
    expect(screen.getByTestId('link-detail-amount').props.children).toBe('$30.00');
    expect(screen.queryByDisplayValue('30.00')).toBeNull();
    fireEvent.press(screen.getByText('Back'));

    expect(screen.getByText('Links')).toBeTruthy();
    fireEvent.press(screen.getByText('Back'));
    expect(onAccept).toHaveBeenCalledWith({ toAdd: [], toUpdate: [], deleteIds: [] });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps historical link amounts read-only and confirms contextual Unlink', () => {
    const snapshot = makeSnapshot();
    snapshot.transactionLinks = [link({ amountMinor: 3000 })];
    const { ref, screen } = renderExpenseManager(snapshot);
    const alertSpy = jest.spyOn(Alert, 'alert');

    fireEvent.press(screen.getByTestId('link-relationship-link'));
    expect(screen.getByTestId('link-source-endpoint')).toBeTruthy();
    expect(screen.getByTestId('link-target-endpoint')).toBeTruthy();
    expect(screen.getByTestId('link-detail-amount').props.children).toBe('$30.00');
    expect(screen.queryByText('Fill remaining')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Link' })).toBeNull();
    expect(ref.current?.getDraftChanges().toUpdate).toEqual([]);

    fireEvent.press(screen.getByRole('button', { name: 'Unlink' }));
    expect(alertSpy).toHaveBeenCalledWith(
      'Unlink transaction?',
      expect.stringContaining('Alice payment'),
      expect.any(Array),
    );
    const cancel = alertSpy.mock.calls[0][2]?.find((button) => button.text === 'Cancel');
    act(() => cancel?.onPress?.());
    expect(ref.current?.getDraftChanges().deleteIds).toEqual([]);

    fireEvent.press(screen.getByRole('button', { name: 'Unlink' }));
    const confirm = alertSpy.mock.calls[1][2]?.find((button) => button.text === 'Unlink');
    act(() => confirm?.onPress?.());
    expect(ref.current?.getDraftChanges().deleteIds).toEqual(['link']);
  });

  it('keeps source terminology, category identity, and signed amount tones', () => {
    const snapshot = makeSnapshot();
    snapshot.transactionLinks = [link({ amountMinor: 3000 })];
    const incomeScreen = renderIncomeManager(snapshot).screen;

    expect(incomeScreen.getByText('Received')).toBeTruthy();
    expect(incomeScreen.getByText('Available')).toBeTruthy();
    expect(incomeScreen.getByText('Used for · 1')).toBeTruthy();
    expect(incomeScreen.getByText('Used for Dinner with friends')).toBeTruthy();
    expect(incomeScreen.getByTestId('link-relationship-link-category-icon')).toBeTruthy();
    expect(incomeScreen.getByTestId('link-relationship-link-signed-amount').props.children).toBe('-$55.00');
    expect(StyleSheet.flatten(incomeScreen.getByTestId('link-relationship-link-signed-amount').props.style).color)
      .toBe(colors.danger);

    const expenseScreen = renderExpenseManager(snapshot).screen;
    expect(expenseScreen.getByTestId('link-relationship-link-signed-amount').props.children).toBe('+$55.00');
    expect(StyleSheet.flatten(expenseScreen.getByTestId('link-relationship-link-signed-amount').props.style).color)
      .toBe(colors.success);
  });

  it('keeps whole and split scopes in authoritative order with contextual eligibility', () => {
    const { screen } = renderExpenseManager(makeSplitSnapshot(), 'split-expense');
    const groups = screen.getAllByTestId(/^link-scope-/)
      .map((node) => node.props.testID as string)
      .filter((testID) => !testID.endsWith('-status') && !testID.endsWith('-toggle') && !testID.endsWith('-relationships'));

    expect(groups).toEqual([
      'link-scope-target:whole',
      'link-scope-target:line-a',
      'link-scope-target:line-b',
      'link-scope-target:line-c',
    ]);
    expect(screen.getByText('Linked $20.00 · Remaining $10.00')).toBeTruthy();
    expect(screen.getByText('Settled')).toBeTruthy();
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('link-scope-target:line-a')).getByText('Link')).toBeTruthy();
    expect(within(screen.getByTestId('link-scope-target:line-b')).queryByText('Link')).toBeNull();

    fireEvent.press(screen.getByTestId('link-scope-target:line-a-toggle'));
    fireEvent.press(screen.getByTestId('link-scope-target:line-b-toggle'));
    expect(screen.getByTestId('link-relationship-link-a-1')).toBeTruthy();
    expect(screen.getByTestId('link-relationship-link-b-1')).toBeTruthy();
  });

  it('groups mixed candidates and reveals only the relevant signed split line', () => {
    const screen = renderIncomeManager(makeMixedCandidateSnapshot()).screen;
    fireEvent.press(screen.getByText('Link'));
    flushAnimationFrames(animationFrames);

    expect(screen.getAllByTestId('link-candidate-paycheck')).toHaveLength(1);
    expect(screen.getByText('Mixed split parent · 2 lines')).toBeTruthy();
    expect(screen.getByText('-$800.00')).toBeTruthy();
    expect(screen.queryByText('Tax withheld')).toBeNull();

    fireEvent.press(screen.getByText('Paycheck'));
    expect(screen.getByText('Tax withheld')).toBeTruthy();
    expect(screen.queryByText('Salary')).toBeNull();
    expect(screen.queryByText('Whole transaction')).toBeNull();
  });

  it('applies a changed status filter immediately and ignores stale expanded candidates', () => {
    const screen = renderIncomeManager(makeMixedCandidateSnapshot()).screen;
    fireEvent.press(screen.getByText('Link'));
    flushAnimationFrames(animationFrames);
    fireEvent.press(screen.getByText('Paycheck'));
    expect(screen.getByText('Tax withheld')).toBeTruthy();

    fireEvent.press(screen.getByText('Partial'));

    expect(screen.getByRole('button', { name: 'Partial' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.queryByText('Paycheck')).toBeNull();
    expect(screen.queryByText('Tax withheld')).toBeNull();
  });

  it('keeps split-line identity visible when settled without an icon beside its name', () => {
    const snapshot = makeMixedCandidateSnapshot();
    snapshot.transactionLines = snapshot.transactionLines.map((item) =>
      item.id === 'refund-line' ? { ...item, amountMinor: 100000 } : item);
    snapshot.transactionLinks = [link({
      id: 'settled-tax',
      sourceTransactionId: 'income',
      targetTransactionId: 'paycheck',
      targetLineId: 'tax-line',
      amountMinor: 80000,
    })];
    const screen = renderIncomeManager(snapshot).screen;
    fireEvent.press(screen.getByText('Link'));
    fireEvent.press(screen.getByText('Settled'));
    flushAnimationFrames(animationFrames);
    fireEvent.press(screen.getByText('Paycheck'));

    expect(screen.getByText('Tax withheld')).toBeTruthy();
    expect(screen.getByTestId('settled-target-option-paycheck:tax-line')).toBeTruthy();
  });

  it('uses one visible back control for editor, candidate, and outer navigation', () => {
    const snapshot = makeMixedCandidateSnapshot();
    const onAccept = jest.fn();
    const onBack = jest.fn();
    let hardwareBack: Parameters<typeof BackHandler.addEventListener>[1] | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_eventName, handler) => {
      hardwareBack = handler;
      return { remove: jest.fn() };
    });
    const screen = render(React.createElement(LinkTransactionScreen, {
      snapshot,
      transactionId: 'income',
      onAcceptTransactionLinkDraft: onAccept,
      onBack,
    }));

    expect(screen.getAllByText('Back')).toHaveLength(1);
    expect(screen.queryByLabelText('Back one step in Links')).toBeNull();
    fireEvent.press(screen.getByText('Link'));
    flushAnimationFrames(animationFrames);
    fireEvent.press(screen.getByText('Paycheck'));
    fireEvent.press(screen.getByText('Tax withheld'));
    expect(screen.getByText('Link transaction')).toBeTruthy();

    fireEvent.press(screen.getByText('Back'));
    expect(screen.getByText('Find transaction')).toBeTruthy();
    act(() => expect(hardwareBack?.({} as never)).toBe(true));
    expect(screen.getByText('Paycheck')).toBeTruthy();
    expect(screen.queryByText('Tax withheld')).toBeNull();
    fireEvent.press(screen.getByText('Back'));
    expect(screen.getByText('Links')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Back'));
    expect(onAccept).toHaveBeenCalledWith({ toAdd: [], toUpdate: [], deleteIds: [] });
    expect(onBack).toHaveBeenCalledTimes(1);
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
  const ref = createRef<TransactionLinkManagerHandle>();
  const screen = render(React.createElement(ExpenseLinkManager, {
    ref,
    snapshot,
    transaction: snapshot.transactions.find((item) => item.id === transactionId)!,
    onError: jest.fn(),
  }));
  return { ref, screen };
}

function renderIncomeManager(snapshot: AppSnapshot) {
  const ref = createRef<TransactionLinkManagerHandle>();
  const screen = render(React.createElement(IncomeLinkManager, {
    ref,
    snapshot,
    transaction: snapshot.transactions.find((item) => item.id === 'income')!,
    onError: jest.fn(),
  }));
  return { ref, screen };
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

function makePaginatedExpenseSnapshot(): AppSnapshot {
  const incomes = Array.from({ length: 45 }, (_, index) => transaction(
    `income-${index}`,
    'income',
    `Income ${index}`,
    new Date(Date.UTC(2026, 6, 31, 12, 0, -index)).toISOString(),
  ));
  return baseSnapshot({
    transactions: [
      transaction('expense', 'expense', 'Dinner with friends', '2026-08-01T10:00:00.000Z'),
      ...incomes,
    ],
    transactionLines: [
      line('expense-line', 'expense', -5500),
      ...incomes.map((item, index) => line(`income-line-${index}`, item.id, 1000)),
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
      line('line-b', 'split-expense', -2000, {
        categoryId: 'bills',
        subcategoryId: 'electricity',
        note: 'B',
      }),
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

function makeMixedCandidateSnapshot(): AppSnapshot {
  return baseSnapshot({
    transactions: [
      transaction('income', 'income', 'Tax refund', '2026-07-13T10:00:00.000Z'),
      transaction('paycheck', 'income', 'Paycheck', '2026-07-12T10:00:00.000Z'),
    ],
    transactionLines: [
      line('refund-line', 'income', 50000, { note: 'Tax refund' }),
      line('salary-line', 'paycheck', 380000, { note: 'Salary' }),
      line('tax-line', 'paycheck', -80000, { note: 'Tax withheld' }),
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
