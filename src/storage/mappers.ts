import {
  normalizeAccountIconName,
  normalizeAccountThemeColor,
} from '../domain/accountThemes';
import { normalizeCurrencyCode } from '../domain/money';
import type {
  Account,
  AccountType,
  Budget,
  BudgetPeriod,
  BudgetScopeItem,
  BudgetScopeType,
  RainyDayFund,
  RecurringFrequency,
  RecurringItem,
  RecurringItemKind,
  RecurringTransactionHistory,
  Transaction,
  TransactionTemplate,
  TransactionTemplateKind,
  TransactionTemplateLine,
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
  period: BudgetPeriod;
  scope_type: BudgetScopeType;
  category_id: string | null;
  subcategory_id: string | null;
  scope_items_json?: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type RecurringItemRow = {
  id: string;
  name: string;
  kind: RecurringItemKind;
  amount_minor: number;
  currency_code: string;
  account_id: string;
  category_id: string;
  subcategory_id: string | null;
  note: string;
  frequency: RecurringFrequency;
  next_due_date: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type RecurringTransactionHistoryRow = {
  id: string;
  recurring_item_id: string;
  transaction_id: string;
  previous_next_due_date: string;
  advanced_next_due_date: string;
  sequence: number;
  created_at: string;
};

export type TransactionTemplateRow = {
  id: string;
  name: string;
  kind: TransactionTemplateKind;
  title: string;
  account_id: string;
  amount_minor: number | null;
  currency_code: string;
  category_id: string | null;
  subcategory_id: string | null;
  notes: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type TransactionTemplateLineRow = {
  id: string;
  template_id: string;
  kind: TransactionTemplateKind | null;
  amount_minor: number;
  category_id: string;
  subcategory_id: string;
  note: string;
  sort_order: number;
  created_at: string;
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
    scopeItems: safeParseBudgetScopeItems(row.scope_items_json, row.scope_type, row.category_id, row.subcategory_id),
    sortOrder: Number.isInteger(row.sort_order) ? row.sort_order : 0,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRecurringItem(row: RecurringItemRow): RecurringItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    amountMinor: row.amount_minor,
    currencyCode: normalizeCurrencyCode(row.currency_code),
    accountId: row.account_id,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id || null,
    note: row.note,
    frequency: row.frequency,
    nextDueDate: row.next_due_date,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapRecurringTransactionHistory(
  row: RecurringTransactionHistoryRow,
): RecurringTransactionHistory {
  return {
    id: row.id,
    recurringItemId: row.recurring_item_id,
    transactionId: row.transaction_id,
    previousNextDueDate: row.previous_next_due_date,
    advancedNextDueDate: row.advanced_next_due_date,
    sequence: row.sequence,
    createdAt: row.created_at,
  };
}

export function mapTransactionTemplate(
  row: TransactionTemplateRow,
  splitLines: TransactionTemplateLine[] = [],
): TransactionTemplate {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    title: row.title,
    accountId: row.account_id,
    amountMinor: row.amount_minor ?? null,
    currencyCode: normalizeCurrencyCode(row.currency_code),
    categoryId: row.category_id || null,
    subcategoryId: row.subcategory_id || null,
    notes: row.notes,
    splitLines,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTransactionTemplateLine(row: TransactionTemplateLineRow): TransactionTemplateLine {
  return {
    id: row.id,
    templateId: row.template_id,
    ...(row.kind ? { kind: row.kind } : {}),
    amountMinor: row.amount_minor,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    note: row.note,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
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

function safeParseBudgetScopeItems(
  value: string | undefined,
  scopeType: BudgetScopeType,
  categoryId: string | null,
  subcategoryId: string | null,
): BudgetScopeItem[] {
  const parsed = safeParseJson(value);
  if (Array.isArray(parsed)) {
    return parsed
      .filter((item): item is Partial<BudgetScopeItem> =>
        Boolean(item && typeof item === 'object' && typeof item.categoryId === 'string'),
      )
      .map((item) => ({
        categoryId: item.categoryId ?? '',
        subcategoryId: typeof item.subcategoryId === 'string' && item.subcategoryId.trim()
          ? item.subcategoryId
          : null,
      }))
      .filter((item) => item.categoryId.trim());
  }

  if (scopeType !== 'overall' && categoryId) {
    return [{
      categoryId,
      subcategoryId: scopeType === 'subcategory' || scopeType === 'include' || scopeType === 'exclude'
        ? subcategoryId || null
        : null,
    }];
  }

  return [];
}
