import {
  compareTransactionDisplayEntriesDescending,
  getAccountBalances,
  getBalanceAfterDisplayEntriesForEntries,
  getCashFlowSummary,
  getRainyDayProgress,
  getSpendingByCategory,
  getTransactionDisplayEntries,
  getUpcomingBills,
  groupBalancesByCurrency,
  type TransactionDisplayEntry,
} from '../../domain/aggregates';
import { getBudgetUsagesForPeriods } from '../../domain/budgetUsage';
import { defaultCategories } from '../../domain/categories';
import { getEffectiveDisplayCurrency } from '../../domain/currency';
import { getDateRangeForPreset, isWithinDateRange } from '../../domain/dates';
import {
  filterTransactionDisplayEntriesBySearch,
  groupTransactionDisplayEntries,
} from '../../domain/transactionList';
import { getTransactionGroupGranularity } from '../../domain/transactionGrouping';
import type { Account, AppSnapshot, NewTransactionInput } from '../../domain/types';
import type { RepositoryDatabase } from '../../storage/repository';
import {
  addAccount,
  createFixture,
  type NodeSQLiteRepositoryDatabase,
  type RepositoryFixture,
} from '../../storage/__tests__/repositoryTestUtils';

type SQLiteValue = string | number | null;

type TransactionInsertRow = [
  id: string,
  kind: string,
  title: string,
  datetime: string,
  notes: string,
  labelsJson: string,
  groupId: string,
  createdAt: string,
  updatedAt: string,
];

type TransactionLineInsertRow = [
  id: string,
  transactionId: string,
  accountId: string,
  amountMinor: number,
  currencyCode: string,
  categoryId: string,
  subcategoryId: string,
  externalParty: string,
  transferPeerAccountId: string,
  note: string,
  createdAt: string,
];

type TransactionLinkInsertRow = [
  id: string,
  sourceTransactionId: string,
  targetTransactionId: string,
  sourceLineId: string,
  targetLineId: string,
  linkType: string,
  amountMinor: number,
  currencyCode: string,
  createdAt: string,
  updatedAt: string,
];

type Measurement<T> = {
  durationMs: number;
  result: T;
};

type PerfDatasetSeed = {
  accounts: {
    everyday: Account;
    savings: Account;
    credit: Account;
    usd: Account;
  };
  linkCount: number;
  lineCount: number;
};

const DATASET_ANCHOR_DATE = new Date('2026-06-19T12:00:00.000Z');
const PERF_HARNESS_ENABLED = process.env.RAINPROOF_PERF_HARNESS === '1';
const describePerf = PERF_HARNESS_ENABLED ? describe : describe.skip;

describePerf('large dataset performance harness', () => {
  jest.setTimeout(20 * 60 * 1000);

  for (const transactionCount of getPerfDatasetSizes()) {
    it(`measures write, refresh, and derived scaling for ${transactionCount} transactions`, async () => {
      const fixture = createFixture();
      try {
        await fixture.repository.initialize('AUD');
        const seed = await measureAsync(() => seedPerfDataset(fixture, transactionCount));
        const tableReads = await measureSnapshotTableReads(fixture.db);
        const snapshot = await measureAsync(() => fixture.repository.getSnapshot());
        const globalDerived = measureGlobalDerived(snapshot.result);
        const transactionList = measureTransactionsViewModel(snapshot.result);
        const addWrite = await measureAsync(() =>
          fixture.repository.addTransaction(getPerfAddTransactionInput(seed.result.accounts.everyday.id)),
        );
        const addRefresh = await measureAsync(() => fixture.repository.getSnapshot());
        const afterAddGlobalDerived = measureGlobalDerived(addRefresh.result);
        const afterAddTransactionList = measureTransactionsViewModel(addRefresh.result);

        const report = {
          transactionCount,
          lineCount: seed.result.lineCount,
          linkCount: seed.result.linkCount,
          seedMs: seed.durationMs,
          snapshotLoadMs: snapshot.durationMs,
          tableReads,
          globalDerived,
          transactionList,
          addTransactionWriteMs: addWrite.durationMs,
          addTransactionRefreshMs: addRefresh.durationMs,
          afterAddGlobalDerivedTotalMs: afterAddGlobalDerived.totalMs,
          afterAddTransactionListTotalMs: afterAddTransactionList.totalMs,
        };

        console.info(`[perf-harness] ${JSON.stringify(report)}`);

        expect(snapshot.result.transactions).toHaveLength(transactionCount);
        expect(snapshot.result.transactionLines).toHaveLength(seed.result.lineCount);
        expect(addRefresh.result.transactions).toHaveLength(transactionCount + 1);
      } finally {
        fixture.cleanup();
      }
    });
  }
});

async function seedPerfDataset(
  { db, repository }: RepositoryFixture,
  transactionCount: number,
): Promise<PerfDatasetSeed> {
  const everyday = await addAccount(repository, {
    name: 'Perf Everyday',
    openingBalanceMinor: 100000,
    currencyCode: 'AUD',
  });
  const savings = await addAccount(repository, {
    name: 'Perf Savings',
    openingBalanceMinor: 500000,
    currencyCode: 'AUD',
    type: 'savings',
  });
  const credit = await addAccount(repository, {
    name: 'Perf Credit',
    openingBalanceMinor: 0,
    currencyCode: 'AUD',
    type: 'credit_card',
  });
  const usd = await addAccount(repository, {
    name: 'Perf USD',
    openingBalanceMinor: 25000,
    currencyCode: 'USD',
  });

  await repository.addBudget({
    name: 'Perf Overall Monthly',
    amountMinor: 300000,
    currencyCode: 'AUD',
    period: 'monthly',
    scopeType: 'overall',
  });
  await repository.addBudget({
    name: 'Perf Food Monthly',
    amountMinor: 90000,
    currencyCode: 'AUD',
    period: 'monthly',
    scopeType: 'include',
    scopeItems: [{ categoryId: 'food', subcategoryId: null }],
  });
  await repository.addBudget({
    name: 'Perf Rolling Expenses',
    amountMinor: 250000,
    currencyCode: 'AUD',
    period: 'rolling_30',
    scopeType: 'exclude',
    scopeItems: [{ categoryId: 'travel', subcategoryId: null }],
  });

  const rows = buildSyntheticTransactionRows({
    accountIds: {
      credit: credit.id,
      everyday: everyday.id,
      savings: savings.id,
      usd: usd.id,
    },
    transactionCount,
  });

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  try {
    await insertRows(db, 'transactions', transactionColumns, rows.transactions, 80);
    await insertRows(db, 'transaction_lines', transactionLineColumns, rows.lines, 70);
    await insertRows(db, 'transaction_links', transactionLinkColumns, rows.links, 70);
    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }

  return {
    accounts: { credit, everyday, savings, usd },
    linkCount: rows.links.length,
    lineCount: rows.lines.length,
  };
}

function buildSyntheticTransactionRows({
  accountIds,
  transactionCount,
}: {
  accountIds: {
    credit: string;
    everyday: string;
    savings: string;
    usd: string;
  };
  transactionCount: number;
}) {
  const transactions: TransactionInsertRow[] = [];
  const lines: TransactionLineInsertRow[] = [];
  const links: TransactionLinkInsertRow[] = [];
  const incomeCandidates: { lineId: string; transactionId: string; amountMinor: number }[] = [];
  const expenseCandidates: { lineId: string; transactionId: string; amountMinor: number }[] = [];
  const maxLinks = Math.max(1, Math.floor(transactionCount * 0.03));

  for (let index = 0; index < transactionCount; index += 1) {
    const transactionId = `perf_tx_${String(index).padStart(6, '0')}`;
    const createdAt = getSyntheticDateTime(index);
    const kind = getSyntheticTransactionKind(index);
    transactions.push([
      transactionId,
      kind,
      `Perf ${kind} ${index}`,
      createdAt,
      '',
      '[]',
      index % 9 === 0 ? 'perf-group' : '',
      createdAt,
      createdAt,
    ]);

    if (kind === 'transfer') {
      const sourceLineId = `perf_line_${String(index).padStart(6, '0')}_0`;
      const targetLineId = `perf_line_${String(index).padStart(6, '0')}_1`;
      lines.push(
        [
          sourceLineId,
          transactionId,
          accountIds.everyday,
          -5000 - (index % 17) * 100,
          'AUD',
          '',
          '',
          '',
          accountIds.savings,
          '',
          createdAt,
        ],
        [
          targetLineId,
          transactionId,
          accountIds.savings,
          5000 + (index % 17) * 100,
          'AUD',
          '',
          '',
          '',
          accountIds.everyday,
          '',
          createdAt,
        ],
      );
      continue;
    }

    if (kind === 'income') {
      const lineId = `perf_line_${String(index).padStart(6, '0')}_0`;
      const amountMinor = 150000 + (index % 7) * 2500;
      lines.push([
        lineId,
        transactionId,
        accountIds.everyday,
        amountMinor,
        'AUD',
        'income',
        index % 3 === 0 ? 'salary' : 'wages',
        '',
        '',
        '',
        createdAt,
      ]);
      incomeCandidates.push({ amountMinor, lineId, transactionId });
      continue;
    }

    if (index % 10 === 0) {
      const splitLines = [
        { amountMinor: -3500 - (index % 5) * 100, categoryId: 'food', subcategoryId: 'groceries' },
        { amountMinor: -2200 - (index % 7) * 100, categoryId: 'bills', subcategoryId: 'electricity' },
        { amountMinor: -1600 - (index % 3) * 100, categoryId: 'transport', subcategoryId: 'fuel' },
      ];
      for (const [lineIndex, splitLine] of splitLines.entries()) {
        const lineId = `perf_line_${String(index).padStart(6, '0')}_${lineIndex}`;
        lines.push([
          lineId,
          transactionId,
          lineIndex === 2 ? accountIds.credit : accountIds.everyday,
          splitLine.amountMinor,
          'AUD',
          splitLine.categoryId,
          splitLine.subcategoryId,
          '',
          '',
          `Perf split line ${lineIndex}`,
          createdAt,
        ]);
        expenseCandidates.push({
          amountMinor: Math.abs(splitLine.amountMinor),
          lineId,
          transactionId,
        });
      }
      addSyntheticLink({ createdAt, expenseCandidates, incomeCandidates, links, maxLinks });
      continue;
    }

    const expenseCategory = getExpenseCategory(index);
    const lineId = `perf_line_${String(index).padStart(6, '0')}_0`;
    const amountMinor = -(1200 + (index % 40) * 85);
    const isUsdLine = index % 37 === 0;
    lines.push([
      lineId,
      transactionId,
      isUsdLine ? accountIds.usd : index % 8 === 0 ? accountIds.credit : accountIds.everyday,
      amountMinor,
      isUsdLine ? 'USD' : 'AUD',
      expenseCategory.categoryId,
      expenseCategory.subcategoryId,
      '',
      '',
      '',
      createdAt,
    ]);
    expenseCandidates.push({ amountMinor: Math.abs(amountMinor), lineId, transactionId });
    addSyntheticLink({ createdAt, expenseCandidates, incomeCandidates, links, maxLinks });
  }

  return { lines, links, transactions };
}

function addSyntheticLink({
  createdAt,
  expenseCandidates,
  incomeCandidates,
  links,
  maxLinks,
}: {
  createdAt: string;
  expenseCandidates: { lineId: string; transactionId: string; amountMinor: number }[];
  incomeCandidates: { lineId: string; transactionId: string; amountMinor: number }[];
  links: TransactionLinkInsertRow[];
  maxLinks: number;
}) {
  if (links.length >= maxLinks || !incomeCandidates.length || expenseCandidates.length % 12 !== 0) {
    return;
  }

  const source = incomeCandidates[incomeCandidates.length - 1];
  const target = expenseCandidates[expenseCandidates.length - 1];
  if (!source || source.transactionId === target.transactionId) {
    return;
  }

  links.push([
    `perf_link_${String(links.length).padStart(6, '0')}`,
    source.transactionId,
    target.transactionId,
    source.lineId,
    target.lineId,
    'reimbursement',
    Math.min(900, source.amountMinor, target.amountMinor),
    'AUD',
    createdAt,
    createdAt,
  ]);
}

async function measureSnapshotTableReads(db: NodeSQLiteRepositoryDatabase) {
  const tableMeasurements = {
    accounts: await measureRead(db, 'SELECT * FROM accounts ORDER BY sort_order ASC, created_at ASC'),
    transactions: await measureRead(
      db,
      'SELECT * FROM transactions ORDER BY datetime DESC, created_at DESC, id DESC',
    ),
    transactionLines: await measureRead(
      db,
      'SELECT * FROM transaction_lines ORDER BY created_at ASC',
    ),
    transactionLinks: await measureRead(
      db,
      'SELECT * FROM transaction_links ORDER BY created_at ASC, id ASC',
    ),
    budgets: await measureRead(
      db,
      `SELECT * FROM budgets
       ORDER BY is_active DESC, sort_order ASC, created_at ASC, id ASC`,
    ),
    settings: await measureRead(db, 'SELECT * FROM settings ORDER BY key ASC'),
  };

  return {
    totalMs: Object.values(tableMeasurements).reduce((sum, item) => sum + item.durationMs, 0),
    tables: tableMeasurements,
  };
}

async function measureRead(db: NodeSQLiteRepositoryDatabase, query: string) {
  const measurement = await measureAsync(() => db.getAllAsync<unknown>(query));
  return {
    durationMs: measurement.durationMs,
    rows: measurement.result.length,
  };
}

function measureGlobalDerived(snapshot: AppSnapshot) {
  return measureSections({
    accountBalances: () => getAccountBalances(snapshot.accounts, snapshot.transactionLines),
    totalsByCurrency: () => groupBalancesByCurrency(getAccountBalances(snapshot.accounts, snapshot.transactionLines)),
    rainyDayProgress: () =>
      getRainyDayProgress(snapshot.rainyDayFund, getAccountBalances(snapshot.accounts, snapshot.transactionLines)),
    currentMonthSpending: () =>
      getSpendingByCategory({
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        range: getDateRangeForPreset('last_month', DATASET_ANCHOR_DATE),
        currencyCode: getCurrentCurrency(snapshot),
      }),
    budgetUsage: () =>
      getBudgetUsagesForPeriods({
        accounts: snapshot.accounts,
        budgets: snapshot.budgets.filter((budget) => budget.currencyCode === getCurrentCurrency(snapshot)),
        categories: snapshot.categories ?? defaultCategories,
        transactionLines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        transactions: snapshot.transactions,
        anchorDate: DATASET_ANCHOR_DATE,
      }),
    upcomingBills: () => getUpcomingBills(snapshot.recurringItems, DATASET_ANCHOR_DATE),
    cashFlow: () =>
      getCashFlowSummary({
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        range: getDateRangeForPreset('last_month', DATASET_ANCHOR_DATE),
        currencyCode: getCurrentCurrency(snapshot),
      }),
  });
}

function measureTransactionsViewModel(snapshot: AppSnapshot) {
  const range = getDateRangeForPreset('last_month', DATASET_ANCHOR_DATE);
  let displayEntries: TransactionDisplayEntry[] = [];
  let visibleEntries = displayEntries;

  return measureSections({
    entries: () => {
      const transactionsInRange = snapshot.transactions.filter((transaction) =>
        isWithinDateRange(transaction.datetime, range));
      displayEntries = getTransactionDisplayEntries({
        transactions: transactionsInRange,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        accountIds: snapshot.accounts.filter((account) => !account.isArchived).map((account) => account.id),
      });
      return displayEntries;
    },
    filterSearch: () => {
      const searchedEntries = filterTransactionDisplayEntriesBySearch({
        entries: displayEntries,
        query: '',
        accounts: snapshot.accounts,
        categories: snapshot.categories ?? defaultCategories,
      });
      visibleEntries = [...searchedEntries].sort(compareTransactionDisplayEntriesDescending);
      return visibleEntries;
    },
    balanceAfter: () =>
      getBalanceAfterDisplayEntriesForEntries({
        accounts: snapshot.accounts,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        entries: visibleEntries,
      }),
    groups: () => groupTransactionDisplayEntries(visibleEntries, getTransactionGroupGranularity(range)),
  });
}

function measureSections(sections: Record<string, () => unknown>) {
  const sectionResults: Record<string, number> = {};
  const startedAt = Date.now();
  for (const [name, run] of Object.entries(sections)) {
    sectionResults[name] = measure(run).durationMs;
  }

  return {
    totalMs: Date.now() - startedAt,
    sections: sectionResults,
  };
}

function measure<T>(run: () => T): Measurement<T> {
  const startedAt = Date.now();
  const result = run();
  return {
    durationMs: Date.now() - startedAt,
    result,
  };
}

async function measureAsync<T>(run: () => Promise<T>): Promise<Measurement<T>> {
  const startedAt = Date.now();
  const result = await run();
  return {
    durationMs: Date.now() - startedAt,
    result,
  };
}

async function insertRows(
  db: RepositoryDatabase,
  tableName: string,
  columns: string[],
  rows: SQLiteValue[][],
  chunkSize: number,
): Promise<void> {
  if (!rows.length) {
    return;
  }

  const valuePlaceholder = `(${columns.map(() => '?').join(', ')})`;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await db.runAsync(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${chunk.map(() => valuePlaceholder).join(', ')}`,
      ...chunk.flat(),
    );
  }
}

function getPerfAddTransactionInput(accountId: string): NewTransactionInput {
  return {
    kind: 'expense',
    title: 'Perf added transaction',
    datetime: DATASET_ANCHOR_DATE.toISOString(),
    lines: [{
      accountId,
      amountMinor: -4321,
      currencyCode: 'AUD',
      categoryId: 'food',
      subcategoryId: 'groceries',
    }],
  };
}

function getCurrentCurrency(snapshot: AppSnapshot): string {
  return getEffectiveDisplayCurrency({
    defaultCurrencyCode: snapshot.defaultCurrencyCode,
    defaultCurrencyMode: snapshot.settings.defaultCurrencyMode,
    accountCurrencyCodes: snapshot.accounts.map((account) => account.currencyCode),
  });
}

function getSyntheticTransactionKind(index: number): 'expense' | 'income' | 'transfer' {
  if (index % 20 === 0) {
    return 'transfer';
  }

  if (index % 6 === 0) {
    return 'income';
  }

  return 'expense';
}

function getSyntheticDateTime(index: number): string {
  const date = new Date(DATASET_ANCHOR_DATE);
  date.setDate(date.getDate() - (index % 730));
  date.setMinutes(index % 60);
  return date.toISOString();
}

function getExpenseCategory(index: number): { categoryId: string; subcategoryId: string } {
  const categories = [
    { categoryId: 'food', subcategoryId: 'groceries' },
    { categoryId: 'shopping', subcategoryId: 'home-goods' },
    { categoryId: 'transport', subcategoryId: 'fuel' },
    { categoryId: 'bills', subcategoryId: 'electricity' },
    { categoryId: 'health', subcategoryId: 'pharmacy' },
    { categoryId: 'entertainment', subcategoryId: 'streaming' },
    { categoryId: 'travel', subcategoryId: 'flights' },
  ];

  return categories[index % categories.length];
}

function getPerfDatasetSizes(): number[] {
  const raw = String(process.env.RAINPROOF_PERF_SIZES ?? '1000,5000,10000');
  return raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

const transactionColumns = [
  'id',
  'kind',
  'title',
  'datetime',
  'notes',
  'labels_json',
  'group_id',
  'created_at',
  'updated_at',
];

const transactionLineColumns = [
  'id',
  'transaction_id',
  'account_id',
  'amount_minor',
  'currency_code',
  'category_id',
  'subcategory_id',
  'external_party',
  'transfer_peer_account_id',
  'note',
  'created_at',
];

const transactionLinkColumns = [
  'id',
  'source_transaction_id',
  'target_transaction_id',
  'source_line_id',
  'target_line_id',
  'link_type',
  'amount_minor',
  'currency_code',
  'created_at',
  'updated_at',
];
