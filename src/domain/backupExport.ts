import type {
  Account,
  AppSettings,
  AppSnapshot,
  Budget,
  CategoryDefinition,
  CurrencyCode,
  RainyDayFund,
  RecurringItem,
  RecurringTransactionHistory,
  Transaction,
  TransactionLine,
  TransactionLink,
  TransactionTemplate,
} from './types';
import {
  checkBackupFormatCompatibility,
  createBackupMetadata,
  DATABASE_SCHEMA_VERSION,
  type BackupMetadata,
} from './versioning';

export const RAINPROOF_BACKUP_FORMAT = 'rainproof-json-backup';

export type RainproofBackupData = {
  defaultCurrencyCode: CurrencyCode;
  settings: AppSettings;
  categories: CategoryDefinition[];
  accounts: Account[];
  transactions: Transaction[];
  transactionLines: TransactionLine[];
  transactionLinks: TransactionLink[];
  budgets: Budget[];
  recurringItems: RecurringItem[];
  recurringTransactionHistory: RecurringTransactionHistory[];
  transactionTemplates: TransactionTemplate[];
  rainyDayFund: RainyDayFund;
};

export type RainproofBackup = {
  format: typeof RAINPROOF_BACKUP_FORMAT;
  metadata: BackupMetadata;
  data: RainproofBackupData;
};

export function buildRainproofBackup(
  snapshot: AppSnapshot,
  exportedAt = new Date().toISOString(),
): RainproofBackup {
  return {
    format: RAINPROOF_BACKUP_FORMAT,
    metadata: createBackupMetadata(exportedAt),
    data: cloneJsonData({
      defaultCurrencyCode: snapshot.defaultCurrencyCode,
      settings: snapshot.settings,
      categories: snapshot.categories ?? [],
      accounts: snapshot.accounts,
      transactions: snapshot.transactions,
      transactionLines: snapshot.transactionLines,
      transactionLinks: snapshot.transactionLinks,
      budgets: snapshot.budgets,
      recurringItems: snapshot.recurringItems,
      recurringTransactionHistory: snapshot.recurringTransactionHistory ?? [],
      transactionTemplates: snapshot.transactionTemplates,
      rainyDayFund: snapshot.rainyDayFund,
    }),
  };
}

export function serializeRainproofBackup(backup: RainproofBackup): string {
  return JSON.stringify(backup);
}

export function getRainproofBackupFilename(exportedAt: string): string {
  const date = exportedAt.slice(0, 10);
  const time = exportedAt.slice(11, 16).replace(':', '');
  return `rainproof-backup-${date}-${time}.rainproof`;
}

export function parseRainproofBackup(value: unknown): RainproofBackup {
  if (!isRecord(value) || value.format !== RAINPROOF_BACKUP_FORMAT) {
    throw new Error('This is not a Rainproof backup.');
  }

  const metadata = value.metadata;
  const data = value.data;
  if (!isRecord(metadata) || !isRecord(data)) {
    throw new Error('The backup is missing required metadata or data.');
  }

  const compatibility = checkBackupFormatCompatibility(metadata.backupFormatVersion);
  if (!compatibility.supported) {
    throw new Error(
      compatibility.reason === 'update_required'
        ? 'This backup was created by a newer Rainproof version.'
        : 'This backup version is not supported.',
    );
  }
  if (!Number.isInteger(metadata.schemaVersion) || Number(metadata.schemaVersion) > DATABASE_SCHEMA_VERSION) {
    throw new Error('This backup requires a newer Rainproof database version.');
  }

  assertArray(data.accounts, 'accounts');
  assertArray(data.categories, 'categories');
  assertArray(data.transactions, 'transactions');
  assertArray(data.transactionLines, 'transaction lines');
  assertArray(data.transactionLinks, 'transaction links');
  assertArray(data.budgets, 'budgets');
  assertArray(data.recurringItems, 'recurring items');
  assertArray(data.recurringTransactionHistory, 'recurring history');
  assertArray(data.transactionTemplates, 'transaction templates');
  if (!isRecord(data.settings) || !isRecord(data.rainyDayFund)) {
    throw new Error('The backup is missing settings or rainy day fund data.');
  }

  const backup = cloneJsonData(value) as RainproofBackup;
  validateBackupReferences(backup.data);
  return backup;
}

function cloneJsonData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function validateBackupReferences(data: RainproofBackupData): void {
  const accountIds = uniqueIds(data.accounts, 'account');
  const transactionIds = uniqueIds(data.transactions, 'transaction');
  const lineIds = uniqueIds(data.transactionLines, 'transaction line');
  uniqueIds(data.transactionLinks, 'transaction link');
  uniqueIds(data.budgets, 'budget');
  const recurringItemIds = uniqueIds(data.recurringItems, 'recurring item');
  uniqueIds(data.recurringTransactionHistory, 'recurring history');
  const templateIds = uniqueIds(data.transactionTemplates, 'transaction template');

  for (const line of data.transactionLines) {
    assertReference(transactionIds, line.transactionId, 'transaction line transaction');
    assertReference(accountIds, line.accountId, 'transaction line account');
    assertSafeInteger(line.amountMinor, 'transaction line amount');
  }

  for (const link of data.transactionLinks) {
    assertReference(transactionIds, link.sourceTransactionId, 'link source transaction');
    assertReference(transactionIds, link.targetTransactionId, 'link target transaction');
    if (link.sourceLineId) {
      assertReference(lineIds, link.sourceLineId, 'link source line');
    }
    if (link.targetLineId) {
      assertReference(lineIds, link.targetLineId, 'link target line');
    }
    assertSafeInteger(link.amountMinor, 'link amount');
  }

  for (const recurringItem of data.recurringItems) {
    if (recurringItem.accountId) {
      assertReference(accountIds, recurringItem.accountId, 'recurring item account');
    }
  }
  for (const history of data.recurringTransactionHistory) {
    assertReference(recurringItemIds, history.recurringItemId, 'recurring history item');
  }
  for (const template of data.transactionTemplates) {
    if (template.accountId) {
      assertReference(accountIds, template.accountId, 'transaction template account');
    }
    for (const line of template.splitLines) {
      if (line.templateId !== template.id || !templateIds.has(line.templateId)) {
        throw new Error('The backup contains an invalid transaction template line.');
      }
      assertSafeInteger(line.amountMinor, 'transaction template line amount');
    }
  }
  for (const accountId of data.rainyDayFund.linkedAccountIds) {
    assertReference(accountIds, accountId, 'rainy day fund account');
  }
}

function uniqueIds(values: unknown[], label: string): Set<string> {
  const ids = new Set<string>();
  for (const value of values) {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()) {
      throw new Error(`The backup contains an invalid ${label}.`);
    }
    if (ids.has(value.id)) {
      throw new Error(`The backup contains a duplicate ${label} id.`);
    }
    ids.add(value.id);
  }
  return ids;
}

function assertReference(ids: Set<string>, id: string, label: string): void {
  if (!ids.has(id)) {
    throw new Error(`The backup contains an invalid ${label} reference.`);
  }
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`The backup contains an invalid ${label}.`);
  }
}

function assertArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`The backup is missing ${label}.`);
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
