import {
  buildRainproofBackup,
  getRainproofBackupFilename,
  parseRainproofBackup,
  RAINPROOF_BACKUP_FORMAT,
  serializeRainproofBackup,
} from '../backupExport';
import type { AppSnapshot } from '../types';
import { APP_NAME, APP_VERSION, BACKUP_FORMAT_VERSION, DATABASE_SCHEMA_VERSION } from '../versioning';

const exportedAt = '2026-06-10T08:30:00.000Z';
const createdAt = '2026-05-01T00:00:00.000Z';

function createSnapshot(): AppSnapshot {
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'manual',
      multiCurrencyEnabled: true,
      enabledCurrencyCodes: ['AUD', 'USD'],
      dashboardSelectedAccountIds: ['account-aud'],
      dashboardCardSettings: [{ id: 'accounts', visible: true }],
      addTransactionDefaults: {
        lastManualAccountId: 'account-aud',
        lastCategoryByKind: {
          expense: { categoryId: 'expense', subcategoryId: 'tax' },
        },
      },
    },
    categories: [
      {
        id: 'expense',
        name: 'Expenses',
        color: '#CC3344',
        icon: 'receipt-outline',
        type: 'expense',
        subcategories: [
          {
            id: 'tax',
            name: 'Tax',
            color: '#CC3344',
            icon: 'document-text-outline',
          },
        ],
      },
    ],
    accounts: [
      {
        id: 'account-aud',
        name: 'Everyday',
        nickname: '',
        type: 'checking',
        currencyCode: 'AUD',
        openingBalanceMinor: 12345,
        notes: '',
        institutionName: 'Bank',
        includeInRainyDay: true,
        themeColor: '#1876A8',
        iconName: 'wallet-outline',
        showOnDashboard: true,
        sortOrder: 0,
        isArchived: false,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    transactions: [
      {
        id: 'transaction-income',
        kind: 'income',
        title: 'Pay',
        datetime: '2026-06-01T09:00:00.000Z',
        notes: 'June pay',
        labels: ['work'],
        groupId: '',
        createdAt,
        updatedAt: createdAt,
      },
    ],
    transactionLines: [
      {
        id: 'line-income',
        transactionId: 'transaction-income',
        accountId: 'account-aud',
        amountMinor: 230000,
        currencyCode: 'AUD',
        categoryId: 'income',
        subcategoryId: 'salary',
        externalParty: '',
        transferPeerAccountId: '',
        note: 'Salary',
        createdAt,
      },
      {
        id: 'line-tax',
        transactionId: 'transaction-income',
        accountId: 'account-aud',
        amountMinor: -60000,
        currencyCode: 'AUD',
        categoryId: 'expense',
        subcategoryId: 'tax',
        externalParty: '',
        transferPeerAccountId: '',
        note: 'Tax',
        createdAt,
      },
    ],
    transactionLinks: [
      {
        id: 'link-1',
        sourceTransactionId: 'transaction-income',
        targetTransactionId: 'transaction-expense',
        sourceLineId: 'line-income',
        targetLineId: null,
        linkType: 'reimbursement',
        amountMinor: 5000,
        currencyCode: 'AUD',
        createdAt,
        updatedAt: createdAt,
      },
    ],
    budgets: [
      {
        id: 'budget-1',
        name: 'Tax',
        amountMinor: 100000,
        currencyCode: 'AUD',
        period: 'rolling_30',
        scopeType: 'include',
        categoryId: null,
        subcategoryId: null,
        scopeItems: [{ categoryId: 'expense', subcategoryId: 'tax' }],
        sortOrder: 2,
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    recurringItems: [
      {
        id: 'recurring-1',
        name: 'Rent',
        kind: 'expense',
        amountMinor: 90000,
        currencyCode: 'AUD',
        accountId: 'account-aud',
        categoryId: 'expense',
        subcategoryId: 'rent',
        note: '',
        frequency: 'monthly',
        nextDueDate: '2026-07-01',
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    recurringBills: [],
    recurringTransactionHistory: [
      {
        id: 'history-1',
        recurringItemId: 'recurring-1',
        transactionId: 'generated-1',
        previousNextDueDate: '2026-06-01',
        advancedNextDueDate: '2026-07-01',
        sequence: 1,
        createdAt,
      },
    ],
    transactionTemplates: [
      {
        id: 'template-1',
        name: 'Mixed pay',
        kind: 'income',
        title: 'Pay',
        accountId: 'account-aud',
        amountMinor: 170000,
        currencyCode: 'AUD',
        categoryId: null,
        subcategoryId: null,
        notes: '',
        splitLines: [
          {
            id: 'template-line-income',
            templateId: 'template-1',
            kind: 'income',
            amountMinor: 230000,
            categoryId: 'income',
            subcategoryId: 'salary',
            note: 'Salary',
            sortOrder: 0,
            createdAt,
          },
          {
            id: 'template-line-expense',
            templateId: 'template-1',
            kind: 'expense',
            amountMinor: 60000,
            categoryId: 'expense',
            subcategoryId: 'tax',
            note: 'Tax',
            sortOrder: 1,
            createdAt,
          },
        ],
        isActive: true,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    rainyDayFund: {
      id: 'rainy-day',
      name: 'Rainy day fund',
      currencyCode: 'AUD',
      goalMinor: 500000,
      linkedAccountIds: ['account-aud'],
      createdAt,
      updatedAt: createdAt,
    },
  };
}

describe('Rainproof backup payload export', () => {
  it('includes explicit format, app, export, and schema metadata', () => {
    const backup = buildRainproofBackup(createSnapshot(), exportedAt);

    expect(backup.format).toBe(RAINPROOF_BACKUP_FORMAT);
    expect(backup.metadata).toMatchObject({
      appName: APP_NAME,
      appVersion: APP_VERSION,
      schemaVersion: DATABASE_SCHEMA_VERSION,
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      exportedAt,
    });
  });

  it('includes restorable finance records and persisted preferences', () => {
    const backup = buildRainproofBackup(createSnapshot(), exportedAt);

    expect(backup.data.accounts).toHaveLength(1);
    expect(backup.data.categories[0].subcategories[0].id).toBe('tax');
    expect(backup.data.transactions[0].id).toBe('transaction-income');
    expect(backup.data.transactionLines.map((line) => line.id)).toEqual(['line-income', 'line-tax']);
    expect(backup.data.transactionLinks[0]).toMatchObject({
      sourceLineId: 'line-income',
      amountMinor: 5000,
      currencyCode: 'AUD',
    });
    expect(backup.data.settings).toMatchObject({
      defaultCurrencyCode: 'AUD',
      dashboardSelectedAccountIds: ['account-aud'],
    });
    expect(backup.data.rainyDayFund.linkedAccountIds).toEqual(['account-aud']);
  });

  it('preserves budget scope/order/period, recurring history, and mixed template lines', () => {
    const backup = buildRainproofBackup(createSnapshot(), exportedAt);

    expect(backup.data.budgets[0]).toMatchObject({
      period: 'rolling_30',
      scopeType: 'include',
      scopeItems: [{ categoryId: 'expense', subcategoryId: 'tax' }],
      sortOrder: 2,
    });
    expect(backup.data.recurringItems[0].nextDueDate).toBe('2026-07-01');
    expect(backup.data.recurringTransactionHistory[0]).toMatchObject({
      previousNextDueDate: '2026-06-01',
      advancedNextDueDate: '2026-07-01',
      transactionId: 'generated-1',
    });
    expect(backup.data.transactionTemplates[0].splitLines.map((line) => line.kind)).toEqual([
      'income',
      'expense',
    ]);
  });

  it('preserves exact signed amounts and currencies without mutating or sharing snapshot data', () => {
    const snapshot = createSnapshot();
    const before = JSON.parse(JSON.stringify(snapshot));
    const backup = buildRainproofBackup(snapshot, exportedAt);

    expect(backup.data.transactionLines.map(({ amountMinor, currencyCode }) => ({ amountMinor, currencyCode }))).toEqual([
      { amountMinor: 230000, currencyCode: 'AUD' },
      { amountMinor: -60000, currencyCode: 'AUD' },
    ]);
    expect(snapshot).toEqual(before);

    backup.data.accounts[0].name = 'Changed only in backup';
    expect(snapshot.accounts[0].name).toBe('Everyday');
  });

  it('serializes compact internal payload JSON and builds a stable .rainproof backup filename', () => {
    const backup = buildRainproofBackup(createSnapshot(), exportedAt);

    expect(JSON.parse(serializeRainproofBackup(backup))).toEqual(backup);
    expect(serializeRainproofBackup(backup)).not.toContain('\n');
    expect(getRainproofBackupFilename(exportedAt)).toBe('rainproof-backup-2026-06-10-0830.rainproof');
  });

  it('validates backup metadata and record references before restore', () => {
    const snapshot = createSnapshot();
    snapshot.transactions.push({
      ...snapshot.transactions[0],
      id: 'transaction-expense',
      kind: 'expense',
    });
    const backup = buildRainproofBackup(snapshot, exportedAt);

    expect(parseRainproofBackup(backup)).toEqual(backup);

    backup.data.transactionLines[0].accountId = 'missing-account';
    expect(() => parseRainproofBackup(backup)).toThrow('invalid transaction line account reference');
  });
});
