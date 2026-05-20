import { getAccountDisplayName } from './accountThemes';
import { getCategory, getSubcategoryColor, getSubcategoryIcon, getSubcategoryName } from './categories';
import type { TransactionDisplayEntry } from './aggregates';
import { isSplitExpenseTransaction } from './splitTransactions';
import { OUTSIDE_MY_ACCOUNTS_LABEL } from './transactionEdit';
import type { Account, CategoryDefinition, TransactionLine } from './types';

export type TransactionAmountTone = 'positive' | 'negative' | 'neutral';

export type TransactionRelationParts = {
  isTransfer: boolean;
  label: string;
  sourceLabel?: string;
  targetLabel?: string;
  highlightSide?: 'source' | 'target';
};

export type TransactionSplitDisplayMetadata = {
  isSplit: boolean;
  splitLineCount: number;
  primaryLine?: TransactionLine;
  primaryCategoryId?: string;
  primarySubcategoryId?: string;
  splitLabel?: string;
};

export function getTransactionSubcategoryLabel(
  entry: TransactionDisplayEntry,
  categories?: CategoryDefinition[],
): string {
  if (entry.transaction.kind === 'transfer') {
    return 'Transfer';
  }

  const line = getTransactionPrimaryLine(entry);
  return line ? getSubcategoryName(line.categoryId, line.subcategoryId, categories) : 'Uncategorized';
}

export function getTransactionItemTitle(entry: TransactionDisplayEntry, categories?: CategoryDefinition[]): string {
  const title = entry.transaction.title.trim();
  return title || getTransactionSubcategoryLabel(entry, categories);
}

export function getTransactionAccountLabel(entry: TransactionDisplayEntry, accounts: Account[]): string {
  const account = accounts.find((item) => item.id === entry.accountId);
  return account ? getAccountDisplayName(account) : 'Account';
}

export function getTransactionRelationLabel(entry: TransactionDisplayEntry, accounts: Account[]): string {
  const parts = getTransactionRelationParts(entry, accounts);
  return parts.label;
}

export function getTransactionRelationParts(
  entry: TransactionDisplayEntry,
  accounts: Account[],
  contextAccountId?: string,
): TransactionRelationParts {
  const line = entry.lines[0];
  const accountLabel = getTransactionAccountLabel(entry, accounts);

  if (!line || entry.transaction.kind !== 'transfer') {
    return {
      isTransfer: false,
      label: accountLabel,
    };
  }

  const peer = accounts.find((item) => item.id === line.transferPeerAccountId);
  const peerLabel = peer ? getAccountDisplayName(peer) : line.externalParty || OUTSIDE_MY_ACCOUNTS_LABEL;
  const sourceLabel = line.amountMinor < 0 ? accountLabel : peerLabel;
  const targetLabel = line.amountMinor < 0 ? peerLabel : accountLabel;
  const sourceAccountId = line.amountMinor < 0 ? line.accountId : line.transferPeerAccountId;
  const targetAccountId = line.amountMinor < 0 ? line.transferPeerAccountId : line.accountId;
  const highlightSide =
    contextAccountId
      ? contextAccountId === sourceAccountId
        ? 'source'
        : contextAccountId === targetAccountId
          ? 'target'
          : undefined
      : line.amountMinor < 0
        ? 'source'
        : line.amountMinor > 0
          ? 'target'
          : undefined;

  return {
    isTransfer: true,
    label: `${sourceLabel} \u2192 ${targetLabel}`,
    sourceLabel,
    targetLabel,
    highlightSide,
  };
}

export function getTransactionCategoryColor(entry: TransactionDisplayEntry, categories?: CategoryDefinition[]): string {
  if (entry.transaction.kind === 'transfer') {
    return '#5F9DB5';
  }

  const line = getTransactionPrimaryLine(entry);
  return line ? getSubcategoryColor(line.categoryId, line.subcategoryId, categories) : getCategory('other', categories).color;
}

export function getTransactionCategoryIcon(entry: TransactionDisplayEntry, categories?: CategoryDefinition[]): string {
  if (entry.transaction.kind === 'transfer') {
    return 'swap-horizontal-outline';
  }

  const line = getTransactionPrimaryLine(entry);
  return line ? getSubcategoryIcon(line.categoryId, line.subcategoryId, categories) : getCategory('other', categories).icon;
}

export function getTransactionSplitDisplayMetadata(entry: TransactionDisplayEntry): TransactionSplitDisplayMetadata {
  const isSplit = isSplitExpenseTransaction(entry.transaction, entry.lines);
  const primaryLine = getTransactionPrimaryLine(entry);

  return {
    isSplit,
    splitLineCount: isSplit ? entry.lines.filter((line) => line.amountMinor < 0).length : 0,
    primaryLine,
    primaryCategoryId: primaryLine?.categoryId,
    primarySubcategoryId: primaryLine?.subcategoryId,
    splitLabel: isSplit ? formatSplitLabel(entry.lines.filter((line) => line.amountMinor < 0).length) : undefined,
  };
}

export function getTransactionPrimaryLine(entry: TransactionDisplayEntry): TransactionLine | undefined {
  if (entry.transaction.kind === 'transfer') {
    return entry.lines[0];
  }

  return entry.lines.reduce<TransactionLine | undefined>((primaryLine, line) => {
    if (!primaryLine) {
      return line;
    }

    return Math.abs(line.amountMinor) > Math.abs(primaryLine.amountMinor) ? line : primaryLine;
  }, undefined);
}

function formatSplitLabel(splitLineCount: number): string {
  return `Split \u00b7 ${splitLineCount} ${splitLineCount === 1 ? 'line' : 'lines'}`;
}

export function formatTransactionShortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function getTransactionAmountTone(amountMinor: number): TransactionAmountTone {
  if (amountMinor > 0) {
    return 'positive';
  }

  if (amountMinor < 0) {
    return 'negative';
  }

  return 'neutral';
}
