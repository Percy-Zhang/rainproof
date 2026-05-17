import type { AccountType, TransactionKind } from '../domain/types';

export const SAMPLE_DATA_VERSION = 2;

export type SeedAccountDefinition = {
  id: string;
  name: string;
  type: AccountType;
  currencyCode: string;
  openingBalanceMinor: number;
  notes: string;
  institutionName: string;
  includeInRainyDay: boolean;
  themeColor: string;
  sortOrder: number;
  now: string;
};

export type SeedTransactionLine = [string, number, string, string, string, string?];

export type SeedTransactionDefinition = {
  kind: TransactionKind;
  title: string;
  datetime: string;
  lines: SeedTransactionLine[];
};

export type SeedBudgetDefinition = {
  categoryId: string;
  currencyCode: string;
  monthlyLimitMinor: number;
};

export type SeedRecurringBillDefinition = {
  name: string;
  amountMinor: number;
  currencyCode: string;
  accountId: string;
  categoryId: string;
  dueDay: number;
};

export function getExpandedSampleAccounts({
  billsId,
  creditCardId,
  currencyCode,
  nowIso,
  travelId,
  usdCashId,
}: {
  billsId: string;
  creditCardId: string;
  currencyCode: string;
  nowIso: string;
  travelId: string;
  usdCashId: string;
}): SeedAccountDefinition[] {
  return [
    {
      id: billsId,
      name: 'Bills Buffer',
      type: 'savings',
      currencyCode,
      openingBalanceMinor: 125000,
      notes: 'Holding account for rent, utilities, and predictable monthly bills.',
      institutionName: '',
      includeInRainyDay: false,
      themeColor: '#6F8FA8',
      sortOrder: 2,
      now: nowIso,
    },
    {
      id: travelId,
      name: 'Travel Fund',
      type: 'savings',
      currencyCode,
      openingBalanceMinor: 62000,
      notes: 'Savings bucket for holidays and larger trips.',
      institutionName: '',
      includeInRainyDay: false,
      themeColor: '#7488C0',
      sortOrder: 3,
      now: nowIso,
    },
    {
      id: usdCashId,
      name: 'USD Cash',
      type: 'cash',
      currencyCode: 'USD',
      openingBalanceMinor: 35000,
      notes: 'Manual foreign-currency account for travel cash or overseas balances.',
      institutionName: '',
      includeInRainyDay: false,
      themeColor: '#B88A3D',
      sortOrder: 4,
      now: nowIso,
    },
    {
      id: creditCardId,
      name: 'Credit Card',
      type: 'credit_card',
      currencyCode,
      openingBalanceMinor: -42000,
      notes: 'Manual card balance. Bank sync and card feeds can be added later.',
      institutionName: '',
      includeInRainyDay: false,
      themeColor: '#C47E67',
      sortOrder: 5,
      now: nowIso,
    },
  ];
}

export function getExpandedSampleTransactions({
  billsId,
  creditCardId,
  currencyCode,
  everydayId,
  now,
  rainyId,
  travelId,
  usdCashId,
}: {
  billsId: string;
  creditCardId: string;
  currencyCode: string;
  everydayId: string;
  now: Date;
  rainyId: string;
  travelId: string;
  usdCashId: string;
}): SeedTransactionDefinition[] {
  return [
    {
      kind: 'expense',
      title: 'Rent',
      datetime: daysAgo(now, 2),
      lines: [[billsId, -215000, currencyCode, 'housing', 'rent']],
    },
    {
      kind: 'expense',
      title: 'Weekly groceries',
      datetime: daysAgo(now, 3),
      lines: [[everydayId, -14235, currencyCode, 'food', 'groceries']],
    },
    {
      kind: 'expense',
      title: 'Train top up',
      datetime: daysAgo(now, 4),
      lines: [[everydayId, -3800, currencyCode, 'transport', 'public-transport']],
    },
    {
      kind: 'expense',
      title: 'Dinner with friends',
      datetime: daysAgo(now, 6),
      lines: [[creditCardId, -6750, currencyCode, 'food', 'restaurants']],
    },
    {
      kind: 'expense',
      title: 'Pharmacy',
      datetime: daysAgo(now, 8),
      lines: [[everydayId, -2475, currencyCode, 'health', 'pharmacy']],
    },
    {
      kind: 'expense',
      title: 'Cinema tickets',
      datetime: daysAgo(now, 10),
      lines: [[creditCardId, -4200, currencyCode, 'entertainment', 'movies']],
    },
    {
      kind: 'expense',
      title: 'Home supplies',
      datetime: daysAgo(now, 12),
      lines: [[everydayId, -5890, currencyCode, 'shopping', 'home-goods']],
    },
    {
      kind: 'expense',
      title: 'Holiday booking deposit',
      datetime: daysAgo(now, 15),
      lines: [[travelId, -18000, currencyCode, 'travel', 'accommodation']],
    },
    {
      kind: 'income',
      title: 'Interest',
      datetime: daysAgo(now, 17),
      lines: [
        [rainyId, 920, currencyCode, 'income', 'interest'],
        [billsId, 330, currencyCode, 'income', 'interest'],
      ],
    },
    {
      kind: 'transfer',
      title: 'Move money to bills',
      datetime: daysAgo(now, 18),
      lines: [
        [everydayId, -160000, currencyCode, '', '', billsId],
        [billsId, 160000, currencyCode, '', '', everydayId],
      ],
    },
    {
      kind: 'transfer',
      title: 'Travel savings top up',
      datetime: daysAgo(now, 21),
      lines: [
        [everydayId, -30000, currencyCode, '', '', travelId],
        [travelId, 30000, currencyCode, '', '', everydayId],
      ],
    },
    {
      kind: 'expense',
      title: 'Airport snack',
      datetime: daysAgo(now, 24),
      lines: [[usdCashId, -1850, 'USD', 'food', 'restaurants']],
    },
    {
      kind: 'income',
      title: 'USD reimbursement',
      datetime: daysAgo(now, 25),
      lines: [[usdCashId, 6000, 'USD', 'income', 'reimbursement']],
    },
  ];
}

export function getExpandedSampleBudgets(currencyCode: string): SeedBudgetDefinition[] {
  return [
    { categoryId: 'food', currencyCode, monthlyLimitMinor: 90000 },
    { categoryId: 'transport', currencyCode, monthlyLimitMinor: 22000 },
    { categoryId: 'shopping', currencyCode, monthlyLimitMinor: 35000 },
    { categoryId: 'entertainment', currencyCode, monthlyLimitMinor: 50000 },
    { categoryId: 'bills', currencyCode, monthlyLimitMinor: 42000 },
    { categoryId: 'health', currencyCode, monthlyLimitMinor: 18000 },
    { categoryId: 'food', currencyCode: 'USD', monthlyLimitMinor: 12000 },
  ];
}

export function getExpandedSampleRecurringBills({
  billsId,
  creditCardId,
  currencyCode,
  everydayId,
}: {
  billsId: string;
  creditCardId: string;
  currencyCode: string;
  everydayId: string;
}): SeedRecurringBillDefinition[] {
  return [
    { name: 'Rent', amountMinor: 215000, currencyCode, accountId: billsId, categoryId: 'housing', dueDay: 1 },
    { name: 'Mobile plan', amountMinor: 3900, currencyCode, accountId: everydayId, categoryId: 'bills', dueDay: 9 },
    {
      name: 'Streaming',
      amountMinor: 1899,
      currencyCode,
      accountId: creditCardId,
      categoryId: 'entertainment',
      dueDay: 14,
    },
    {
      name: 'Car insurance',
      amountMinor: 12200,
      currencyCode,
      accountId: billsId,
      categoryId: 'transport',
      dueDay: 20,
    },
    { name: 'Gym', amountMinor: 6400, currencyCode, accountId: creditCardId, categoryId: 'health', dueDay: 26 },
  ];
}

function daysAgo(from: Date, days: number): string {
  const next = new Date(from);
  next.setDate(next.getDate() - days);
  return next.toISOString();
}
