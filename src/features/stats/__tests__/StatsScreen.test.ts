import React from 'react';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { fireEvent, render, within } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { defaultCategories } from '../../../domain/categories';
import type {
  Account,
  AccountBalance,
  AppSnapshot,
  RecurringItem,
  Transaction,
  TransactionLine,
} from '../../../domain/types';
import { StatsScreen } from '../StatsScreen';
import { useStatsViewModel } from '../useStatsViewModel';

jest.mock('@expo/vector-icons', () => {
  return { Ionicons: 'Ionicons' };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

describe('StatsScreen report kind switch', () => {
  it('defaults to Expenses and excludes income and transfers from the donut rows', () => {
    const screen = renderStatsScreen();

    expect(screen.getByTestId('stats-report-mode-expense').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('stats-match-row-food-line')).toBeTruthy();
    expect(screen.queryByTestId('stats-match-row-salary-line')).toBeNull();
    expect(screen.queryByTestId('stats-match-row-transfer-out')).toBeNull();
  });

  it('keeps the report switch in the spending card with the existing recent rows', () => {
    const screen = renderStatsScreen();
    const spendingCard = within(screen.getByTestId('spending-chart-card'));

    expect(spendingCard.getByTestId('stats-report-mode-row')).toBeTruthy();
    expect(spendingCard.getByTestId('stats-report-mode-expense')).toBeTruthy();
    expect(spendingCard.getByText('Recent matches')).toBeTruthy();
    expect(spendingCard.getByTestId('stats-match-row-food-line')).toBeTruthy();
  });

  it('switches the donut rows to Income and excludes expenses and transfers', () => {
    const screen = renderStatsScreen();

    fireEvent.press(screen.getByTestId('stats-report-mode-income'));

    expect(screen.getByTestId('stats-report-mode-income').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getAllByText('Income').length).toBeGreaterThan(0);
    expect(screen.getByText('Recent income')).toBeTruthy();
    expect(screen.getByTestId('stats-match-row-salary-line')).toBeTruthy();
    expect(screen.getByTestId('stats-match-row-bonus-line')).toBeTruthy();
    expect(screen.queryByTestId('stats-match-row-food-line')).toBeNull();
    expect(screen.queryByTestId('stats-match-row-transfer-in')).toBeNull();
  });

  it('clears the selected expense segment when switching to Income', () => {
    const screen = renderStatsScreen();

    expect(screen.getByTestId('selected-spending-trend-card')).toBeTruthy();

    fireEvent.press(screen.getByTestId('stats-report-mode-income'));

    expect(screen.queryByTestId('selected-spending-trend-card')).toBeNull();
    expect(screen.getByText('All income - $1,200.00')).toBeTruthy();
  });

  it('opens income drilldown routes when Income mode is active', () => {
    const onOpenStatsDrilldown = jest.fn();
    const screen = renderStatsScreen({ onOpenStatsDrilldown });

    fireEvent.press(screen.getByTestId('stats-report-mode-income'));
    fireEvent.press(screen.getByTestId('stats-donut-chart'), {
      nativeEvent: { locationX: 110, locationY: 10 },
    });
    fireEvent.press(screen.getByText('See all'));

    expect(onOpenStatsDrilldown).toHaveBeenCalledWith(expect.objectContaining({
      reportKind: 'income',
      categoryId: 'income',
      currencyCode: 'AUD',
    }));
  });

  it('shows category changes for the active report mode', () => {
    const screen = renderStatsScreen();

    expect(screen.getByTestId('stats-category-changes-card')).toBeTruthy();
    expect(screen.getByTestId('stats-category-change-food')).toBeTruthy();
    expect(screen.queryByTestId('stats-category-change-income')).toBeNull();

    fireEvent.press(screen.getByTestId('stats-report-mode-income'));

    expect(screen.getByTestId('stats-category-change-income')).toBeTruthy();
    expect(screen.queryByTestId('stats-category-change-food')).toBeNull();
  });

  it('keeps the complete cash flow waterfall independent of the donut report mode', () => {
    const screen = renderStatsScreen();

    expect(screen.getByTestId('stats-cash-flow-waterfall-card')).toBeTruthy();
    expect(screen.getByTestId('stats-cash-flow-step-income')).toBeTruthy();
    expect(screen.getByTestId('stats-cash-flow-step-expense:food')).toBeTruthy();
    expect(screen.queryByTestId('stats-cash-flow-step-transfers')).toBeNull();

    fireEvent.press(screen.getByTestId('stats-report-mode-income'));

    expect(screen.getByTestId('stats-cash-flow-step-income')).toBeTruthy();
    expect(screen.getByTestId('stats-cash-flow-step-expense:food')).toBeTruthy();
  });

  it('opens existing current-period drilldowns from meaningful waterfall steps', () => {
    const onOpenStatsDrilldown = jest.fn();
    const screen = renderStatsScreen({ onOpenStatsDrilldown });

    fireEvent.press(screen.getByTestId('stats-cash-flow-step-income'));
    fireEvent.press(screen.getByTestId('stats-cash-flow-step-expense:food'));

    expect(onOpenStatsDrilldown).toHaveBeenNthCalledWith(1, expect.objectContaining({
      reportKind: 'income',
      categoryId: 'income',
      accountIds: ['acct-a', 'acct-b'],
      currencyCode: 'AUD',
    }));
    expect(onOpenStatsDrilldown).toHaveBeenNthCalledWith(2, expect.objectContaining({
      reportKind: 'expense',
      categoryId: 'food',
      accountIds: ['acct-a', 'acct-b'],
      currencyCode: 'AUD',
    }));
  });

  it('opens the existing current-period category drilldown from a comparison row', () => {
    const onOpenStatsDrilldown = jest.fn();
    const screen = renderStatsScreen({ onOpenStatsDrilldown });

    fireEvent.press(screen.getByTestId('stats-category-change-food'));

    expect(onOpenStatsDrilldown).toHaveBeenCalledWith(expect.objectContaining({
      reportKind: 'expense',
      categoryId: 'food',
      accountIds: ['acct-a', 'acct-b'],
      currencyCode: 'AUD',
      initialSort: 'date_newest',
    }));
  });

  it('shows the category changes empty state when neither period has data', () => {
    const screen = renderStatsScreen({ noTransactions: true });

    expect(screen.getByTestId('stats-category-changes-empty').props.children).toBe(
      'No category changes for this period.',
    );
  });

  it('renders Balance History with the latest selected combined balance', () => {
    const screen = renderStatsScreen();

    expect(screen.getByTestId('stats-balance-history-card')).toBeTruthy();
    expect(screen.queryByTestId('stats-balance-range-1m')).toBeNull();
    expect(screen.queryByTestId('stats-balance-range-7d')).toBeNull();
    expect(screen.getByTestId('stats-balance-mode-history').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$1,120.00');
    expect(screen.getByTestId('stats-balance-selected-change')).toBeTruthy();
  });

  it('switches Balance History between History, Combined, and Forecast modes', () => {
    const screen = renderStatsScreen({
      recurringItems: [
        recurringItem({
          amountMinor: 4000,
          frequency: 'one_time',
          id: 'today-expense',
          nextDueDate: getIsoDateDaysAgo(0),
        }),
      ],
    });

    fireEvent.press(screen.getByTestId('stats-balance-mode-combined'));
    expect(screen.getByTestId('stats-balance-mode-combined').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$1,120.00');

    fireEvent.press(screen.getByTestId('stats-balance-mode-forecast'));

    expect(screen.getByTestId('stats-balance-mode-forecast').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByText('Projected balance from upcoming payments')).toBeTruthy();
    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$1,080.00');
    expect(screen.getByTestId('stats-balance-selected-change').props.children).toBe('-$40.00');
  });

  it('does not render forecast event markers in History mode', () => {
    const today = getIsoDateDaysAgo(0);
    const screen = renderStatsScreen({
      recurringItems: [
        recurringItem({
          amountMinor: 4000,
          id: 'rent',
          name: 'Rent',
          nextDueDate: today,
        }),
      ],
    });

    expect(screen.queryByTestId(`stats-balance-event-marker-forecast:${today}`)).toBeNull();
  });

  it('renders Forecast event markers and single-payment detail', () => {
    const today = getIsoDateDaysAgo(0);
    const screen = renderStatsScreen({
      recurringItems: [
        recurringItem({
          amountMinor: 4000,
          id: 'rent',
          name: 'Rent',
          nextDueDate: today,
        }),
      ],
    });

    fireEvent.press(screen.getByTestId('stats-balance-mode-forecast'));

    expect(screen.getByTestId(`stats-balance-event-marker-forecast:${today}`)).toBeTruthy();
    expect(screen.getByTestId('stats-balance-event-date').props.children).toBe(formatLongDateForTest(today));
    expect(screen.getByTestId('stats-balance-event-title').props.children).toBe('Rent');
    expect(screen.getByTestId('stats-balance-event-net-change').props.children).toEqual([
      '-$40.00',
      ' ',
      'AUD',
    ]);
    expect(screen.getByTestId('stats-balance-event-projected-balance').props.children).toBe('$1,080.00');
  });

  it('groups multiple same-day forecast occurrences in stable order', () => {
    const today = getIsoDateDaysAgo(0);
    const screen = renderStatsScreen({
      recurringItems: [
        recurringItem({
          amountMinor: 4000,
          id: 'rent',
          name: 'Rent',
          nextDueDate: today,
        }),
        recurringItem({
          amountMinor: 800,
          id: 'internet',
          name: 'Internet',
          nextDueDate: today,
        }),
        recurringItem({
          amountMinor: 1600,
          id: 'insurance',
          name: 'Insurance',
          nextDueDate: today,
        }),
      ],
    });

    fireEvent.press(screen.getByTestId('stats-balance-mode-forecast'));

    expect(screen.getByTestId('stats-balance-event-title').props.children).toBe('3 upcoming payments');
    expect(screen.getByTestId('stats-balance-event-net-change').props.children).toEqual([
      '-$64.00',
      ' ',
      'AUD',
    ]);
    expect(within(screen.getByTestId('stats-balance-event-occurrence-0')).getByText('Rent')).toBeTruthy();
    expect(within(screen.getByTestId('stats-balance-event-occurrence-1')).getByText('Internet')).toBeTruthy();
    expect(within(screen.getByTestId('stats-balance-event-occurrence-2')).getByText('Insurance')).toBeTruthy();
  });

  it('renders Combined forecast event markers for future event days', () => {
    const tomorrow = getIsoDateDaysAhead(1);
    const screen = renderStatsScreen({
      recurringItems: [
        recurringItem({
          amountMinor: 4000,
          id: 'rent',
          name: 'Rent',
          nextDueDate: tomorrow,
        }),
      ],
    });

    fireEvent.press(screen.getByTestId('stats-balance-mode-combined'));

    expect(screen.getByTestId(`stats-balance-event-marker-forecast:${tomorrow}`)).toBeTruthy();
    expect(screen.queryByTestId('stats-balance-event-detail')).toBeNull();
  });

  it('dismisses stale event detail when switching Balance History modes', () => {
    const today = getIsoDateDaysAgo(0);
    const screen = renderStatsScreen({
      recurringItems: [
        recurringItem({
          amountMinor: 4000,
          id: 'rent',
          name: 'Rent',
          nextDueDate: today,
        }),
      ],
    });

    fireEvent.press(screen.getByTestId('stats-balance-mode-forecast'));
    expect(screen.getByTestId('stats-balance-event-detail')).toBeTruthy();

    fireEvent.press(screen.getByTestId('stats-balance-mode-history'));

    expect(screen.queryByTestId('stats-balance-event-detail')).toBeNull();
    expect(screen.queryByTestId(`stats-balance-event-marker-forecast:${today}`)).toBeNull();
  });

  it('shows a flat forecast from the current selected balance when there are no upcoming payments', () => {
    const screen = renderStatsScreen();

    fireEvent.press(screen.getByTestId('stats-balance-mode-forecast'));

    expect(screen.queryByTestId('stats-balance-history-empty')).toBeNull();
    expect(screen.queryByTestId(`stats-balance-event-marker-forecast:${getIsoDateDaysAgo(0)}`)).toBeNull();
    expect(screen.queryByTestId('stats-balance-event-detail')).toBeNull();
    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$1,120.00');
    expect(screen.getByTestId('stats-balance-selected-change').props.children).toBe('$0.00');
  });

  it('uses the selected accounts and active currency as the forecast anchor and occurrence filter', () => {
    const screen = renderStatsScreen({
      defaultSelectedAccountIds: ['acct-a', 'acct-usd'],
      includeUsdAccount: true,
      recurringItems: [
        recurringItem({
          accountId: 'acct-a',
          amountMinor: 4000,
          currencyCode: 'AUD',
          id: 'aud-expense',
          nextDueDate: getIsoDateDaysAgo(0),
        }),
        recurringItem({
          accountId: 'acct-usd',
          amountMinor: 500,
          currencyCode: 'USD',
          id: 'usd-expense',
          nextDueDate: getIsoDateDaysAgo(0),
        }),
      ],
    });

    fireEvent.press(screen.getByText('USD'));
    fireEvent.press(screen.getByTestId('stats-balance-mode-forecast'));

    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$10.00');
  });

  it('resets stale selected Balance History points when mode changes', () => {
    const screen = renderStatsScreen({ includeOlderBalanceMovement: true });

    fireEvent(screen.getByTestId('stats-balance-history-chart'), 'responderGrant', {
      nativeEvent: { locationX: 0 },
    });
    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$0.00');

    fireEvent.press(screen.getByTestId('stats-balance-mode-forecast'));

    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$1,420.00');
  });

  it('uses the selected Statistics accounts for Balance History', () => {
    const screen = renderStatsScreen({ defaultSelectedAccountIds: ['acct-a'] });

    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$870.00');
  });

  it('refreshes Balance History when the active currency changes', () => {
    const screen = renderStatsScreen({
      defaultSelectedAccountIds: ['acct-a', 'acct-usd'],
      includeUsdAccount: true,
    });

    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$870.00');

    fireEvent.press(screen.getByText('USD'));

    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$15.00');
  });

  it('uses the active Statistics period for Balance History and resets selection to the latest point', () => {
    const screen = renderStatsScreen({ includeOlderBalanceMovement: true });

    fireEvent(screen.getByTestId('stats-balance-history-chart'), 'responderGrant', {
      nativeEvent: { locationX: 0 },
    });
    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$0.00');

    selectStatsPeriod(screen, '7 days');

    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$1,420.00');

    fireEvent(screen.getByTestId('stats-balance-history-chart'), 'responderGrant', {
      nativeEvent: { locationX: 0 },
    });
    expect(screen.getByTestId('stats-balance-selected-balance').props.children).toBe('$300.00');
  });

  it('passes custom Statistics date bounds through to Balance History exactly', () => {
    const accounts = [
      account('acct-a', 'Everyday', 'AUD'),
      account('acct-b', 'Savings', 'AUD'),
    ];
    const screen = render(React.createElement(StatsViewModelProbe, {
      snapshot: snapshot(accounts, false, true),
    }));
    const customStartDate = getIsoDateDaysAgo(5);
    const customEndDate = getIsoDateDaysAgo(1);

    fireEvent.press(screen.getByTestId('probe-select-first-balance-point'));
    expect(screen.getByTestId('probe-selected-balance-minor').props.children).toBe('0');

    fireEvent.press(screen.getByTestId('probe-select-custom-period'));
    fireEvent.press(screen.getByTestId('probe-open-custom-start'));
    fireEvent.press(screen.getByTestId('probe-set-custom-start'));
    fireEvent.press(screen.getByTestId('probe-open-custom-end'));
    fireEvent.press(screen.getByTestId('probe-set-custom-end'));

    expect(screen.getByTestId('probe-selected-balance-date').props.children).toBe(customEndDate);
    expect(screen.getByTestId('probe-selected-balance-minor').props.children).toBe('142000');

    fireEvent.press(screen.getByTestId('probe-select-first-balance-point'));

    expect(screen.getByTestId('probe-selected-balance-date').props.children).toBe(customStartDate);
    expect(screen.getByTestId('probe-selected-balance-minor').props.children).toBe('30000');
  });
});

function renderStatsScreen({
  defaultSelectedAccountIds,
  includeOlderBalanceMovement = false,
  includeUsdAccount = false,
  noTransactions = false,
  onOpenStatsDrilldown = jest.fn(),
  recurringItems = [],
}: {
  defaultSelectedAccountIds?: string[];
  includeOlderBalanceMovement?: boolean;
  includeUsdAccount?: boolean;
  noTransactions?: boolean;
  onOpenStatsDrilldown?: jest.Mock;
  recurringItems?: RecurringItem[];
} = {}) {
  const accounts = [
    account('acct-a', 'Everyday', 'AUD'),
    account('acct-b', 'Savings', 'AUD'),
    ...(includeUsdAccount ? [account('acct-usd', 'USD Wallet', 'USD')] : []),
  ];
  const statsSnapshot = snapshot(accounts, includeUsdAccount, includeOlderBalanceMovement, recurringItems);

  return render(React.createElement(StatsScreen, {
    accountBalances: accounts.map((item) => ({ account: item, balanceMinor: 0 } satisfies AccountBalance)),
    defaultSelectedAccountIds,
    snapshot: noTransactions
      ? { ...statsSnapshot, transactions: [], transactionLines: [] }
      : statsSnapshot,
    onOpenStatsDrilldown,
  }));
}

function snapshot(
  accounts: Account[],
  includeUsdAccount = false,
  includeOlderBalanceMovement = false,
  recurringItems: RecurringItem[] = [],
): AppSnapshot {
  const recentDate = getRecentIsoDate();
  const olderDate = getIsoDateDaysAgo(10);
  const transactions = [
    ...(includeOlderBalanceMovement ? [transaction('older-income', 'income', 'Older income', `${olderDate}T12:00:00.000Z`)] : []),
    transaction('expense-food', 'expense', 'Groceries', recentDate),
    transaction('mixed-pay', 'income', 'Pay with deductions', recentDate),
    transaction('transfer', 'transfer', 'Move money', recentDate),
    ...(includeUsdAccount ? [transaction('usd-income', 'income', 'USD income', recentDate)] : []),
  ];
  const transactionLines = [
    ...(includeOlderBalanceMovement ? [line('older-income-line', 'older-income', 'acct-a', 30000, 'income', 'salary')] : []),
    line('food-line', 'expense-food', 'acct-a', -5000, 'food', 'groceries'),
    line('salary-line', 'mixed-pay', 'acct-a', 100000, 'income', 'salary'),
    line('bonus-line', 'mixed-pay', 'acct-a', 20000, 'income', 'bonus'),
    line('tax-line', 'mixed-pay', 'acct-a', -3000, 'tax', 'withholding'),
    line('transfer-out', 'transfer', 'acct-a', -25000, 'other', 'miscellaneous'),
    line('transfer-in', 'transfer', 'acct-b', 25000, 'other', 'miscellaneous'),
    ...(includeUsdAccount ? [line('usd-income-line', 'usd-income', 'acct-usd', 1500, 'income', 'salary', 'USD')] : []),
  ];

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
    accounts,
    transactions,
    transactionLines,
    transactionLinks: [],
    budgets: [],
    recurringItems,
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

function StatsViewModelProbe({ snapshot }: { snapshot: AppSnapshot }) {
  const customStartDate = getIsoDateDaysAgo(5);
  const customEndDate = getIsoDateDaysAgo(1);
  const viewModel = useStatsViewModel({
    bottomInset: 0,
    snapshot,
  });

  return React.createElement(React.Fragment, null,
    React.createElement(Text, { testID: 'probe-selected-balance-date' },
      viewModel.selectedBalanceHistoryPoint?.date ?? 'none',
    ),
    React.createElement(Text, { testID: 'probe-selected-balance-minor' },
      String(viewModel.selectedBalanceHistoryPoint?.balanceMinor ?? 'none'),
    ),
    React.createElement(Pressable, {
      testID: 'probe-select-first-balance-point',
      onPress: () => viewModel.selectBalanceHistoryPoint(viewModel.balanceHistoryPoints[0]?.id ?? ''),
    }, React.createElement(Text, null, 'Select first')),
    React.createElement(Pressable, {
      testID: 'probe-select-custom-period',
      onPress: () => viewModel.selectPeriodOption('custom'),
    }, React.createElement(Text, null, 'Custom')),
    React.createElement(Pressable, {
      testID: 'probe-open-custom-start',
      onPress: () => viewModel.setDatePickerTarget('start'),
    }, React.createElement(Text, null, 'Open start')),
    React.createElement(Pressable, {
      testID: 'probe-set-custom-start',
      onPress: () =>
        viewModel.handleDatePickerChange(
          { type: 'set' } as DateTimePickerEvent,
          new Date(`${customStartDate}T12:00:00`),
        ),
    }, React.createElement(Text, null, 'Set start')),
    React.createElement(Pressable, {
      testID: 'probe-open-custom-end',
      onPress: () => viewModel.setDatePickerTarget('end'),
    }, React.createElement(Text, null, 'Open end')),
    React.createElement(Pressable, {
      testID: 'probe-set-custom-end',
      onPress: () =>
        viewModel.handleDatePickerChange(
          { type: 'set' } as DateTimePickerEvent,
          new Date(`${customEndDate}T12:00:00`),
        ),
    }, React.createElement(Text, null, 'Set end')),
  );
}

function account(id: string, name: string, currencyCode: string): Account {
  return {
    id,
    name,
    nickname: '',
    type: 'checking',
    currencyCode,
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

function transaction(id: string, kind: Transaction['kind'], title: string, datetime: string): Transaction {
  return {
    id,
    kind,
    title,
    datetime,
    notes: '',
    labels: [],
    groupId: '',
    createdAt: datetime,
    updatedAt: datetime,
  };
}

function line(
  id: string,
  transactionId: string,
  accountId: string,
  amountMinor: number,
  categoryId: string,
  subcategoryId: string,
  currencyCode = 'AUD',
): TransactionLine {
  return {
    id,
    transactionId,
    accountId,
    amountMinor,
    currencyCode,
    categoryId,
    subcategoryId,
    externalParty: '',
    transferPeerAccountId: '',
    note: '',
    createdAt: '',
  };
}

function recurringItem(overrides: Partial<RecurringItem> = {}): RecurringItem {
  return {
    id: 'plan',
    name: 'Plan',
    kind: 'expense',
    amountMinor: 12000,
    currencyCode: 'AUD',
    accountId: 'acct-a',
    categoryId: 'housing',
    subcategoryId: 'rent',
    note: '',
    frequency: 'one_time',
    nextDueDate: getIsoDateDaysAgo(0),
    completedAt: null,
    splitLines: [],
    isActive: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function getRecentIsoDate(): string {
  return `${getIsoDateDaysAgo(2)}T12:00:00.000Z`;
}

function getIsoDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12, 0, 0, 0);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function getIsoDateDaysAhead(daysAhead: number): string {
  return getIsoDateDaysAgo(-daysAhead);
}

function formatLongDateForTest(dateValue: string): string {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
  }).format(new Date(year, month - 1, day, 12));
}

function selectStatsPeriod(
  screen: ReturnType<typeof render>,
  label: string,
) {
  fireEvent(screen.getByTestId('stats-period-carousel'), 'layout', {
    nativeEvent: { layout: { height: 46, width: 320 } },
  });
  fireEvent.press(screen.getByText(label));
}
