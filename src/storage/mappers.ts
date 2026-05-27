import {
  normalizeAccountIconName,
  normalizeAccountThemeColor,
} from '../domain/accountThemes';
import { normalizeCurrencyCode } from '../domain/money';
import type {
  Account,
  AccountType,
  Budget,
  RainyDayFund,
  RecurringBill,
  Transaction,
  TransactionKind,
  TransactionLine,
  TransactionLink,
  TransactionLinkType,
} from '../domain/types';

export type SettingRow = { value: string };
export type CountRow = { count: number };

export type AccountRow = {
  id: string;
  name: string;
  nickname: string;
  type: AccountType;
  currency_code: string;
  opening_balance_minor: number;
  credit_limit_minor: number | null;
  notes: string;
  institution_name: string;
  include_in_rainy_day: number;
  theme_color: string;
  icon_name: string;
  show_on_dashboard: number;
  sort_order: number;
  is_archived: number;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: string;
  kind: TransactionKind;
  title: string;
  datetime: string;
  notes: string;
  labels_json: string;
  group_id: string;
  created_at: string;
  updated_at: string;
};

export type TransactionLineRow = {
  id: string;
  transaction_id: string;
  account_id: string;
  amount_minor: number;
  currency_code: string;
  category_id: string;
  subcategory_id: string;
  external_party: string;
  transfer_peer_account_id: string;
  note: string;
  created_at: string;
};

export type TransactionLinkRow = {
  id: string;
  source_transaction_id: string;
  target_transaction_id: string;
  source_line_id: string | null;
  target_line_id: string | null;
  link_type: TransactionLinkType;
  amount_minor: number;
  currency_code: string;
  created_at: string;
  updated_at: string;
};

export type BudgetRow = {
  id: string;
  name: string;
  amount_minor: number;
  currency_code: string;
  period: 'monthly';
  scope_type: 'overall' | 'category' | 'subcategory';
  category_id: string | null;
  subcategory_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type RecurringBillRow = {
  id: string;
  name: string;
  amount_minor: number;
  currency_code: string;
  account_id: string;
  category_id: string;
  due_day: number;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type RainyDayFundRow = {
  id: string;
  name: string;
  currency_code: string;
  goal_minor: number;
  created_at: string;
  updated_at: string;
};

export type LinkedAccountRow = {
  account_id: string;
};

export type TableColumnRow = {
  name: string;
};

export function mapAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    nickname: row.nickname,
    type: row.type,
    currencyCode: normalizeCurrencyCode(row.currency_code),
    openingBalanceMinor: row.opening_balance_minor,
    creditLimitMinor: row.credit_limit_minor ?? null,
    notes: row.notes,
    institutionName: row.institution_name,
    includeInRainyDay: row.include_in_rainy_day === 1,
    themeColor: normalizeAccountThemeColor(row.theme_color),
    iconName: normalizeAccountIconName(row.icon_name, row.type),
    showOnDashboard: row.show_on_dashboard === 1,
    sortOrder: row.sort_order,
    isArchived: row.is_archived === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    datetime: row.datetime,
    notes: row.notes,
    labels: safeParseLabels(row.labels_json),
    groupId: row.group_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTransactionLine(row: TransactionLineRow): TransactionLine {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    accountId: row.account_id,
    amountMinor: row.amount_minor,
    currencyCode: normalizeCurrencyCode(row.currency_code),
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    externalParty: row.external_party,
    transferPeerAccountId: row.transfer_peer_account_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function mapTransactionLink(row: TransactionLinkRow): TransactionLink {
  return {
    id: row.id,
    sourceTransactionId: row.source_transaction_id,
    targetTransactionId: row.target_transaction_id,
    sourceLineId: row.source_line_id || null,
    targetLineId: row.target_line_id || null,
    linkType: row.link_type,
    amountMinor: row.amount_minor,
    currencyCode: normalizeCurrencyCode(row.currency_code),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBudget(row: BudgetRow): Budget {
  return {
    id: row.id,
    name: row.name,
    amountMinor: row.amount_minor,
    currencyCode: normalizeCurrencyCode(row.currency_code),
    period: row.period,
    scopeType: row.scope_type,
    categoryId: row.category_id || null,
    subcategoryId: row.subcategory_id || null,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRecurringBill(row: RecurringBillRow): RecurringBill {
  return {
    id: row.id,
    name: row.name,
    amountMinor: row.amount_minor,
    currencyCode: normalizeCurrencyCode(row.currency_code),
    accountId: row.account_id,
    categoryId: row.category_id,
    dueDay: row.due_day,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRainyDayFund(row: RainyDayFundRow, linkedAccountIds: string[]): RainyDayFund {
  return {
    id: row.id,
    name: row.name,
    currencyCode: normalizeCurrencyCode(row.currency_code),
    goalMinor: row.goal_minor,
    linkedAccountIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function safeParseLabels(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((label) => typeof label === 'string') : [];
  } catch {
    return [];
  }
}

export function safeParseCurrencyCodes(value: string | undefined): string[] {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((currencyCode) => typeof currencyCode === 'string') : [];
  } catch {
    return [];
  }
}

export function safeParseNullableStringArray(value: string | undefined): string[] | null {
  if (value === undefined) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : null;
  } catch {
    return null;
  }
}

export function safeParseJson(value: string | undefined): unknown {
  try {
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
}
