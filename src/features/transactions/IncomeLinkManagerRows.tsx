import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccountIconBadge } from '../../components/AccountDisplay';
import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { getAccountDisplayName } from '../../domain/accountThemes';
import {
  getSubcategoryColor,
  getSubcategoryIcon,
} from '../../domain/categories';
import { formatMoney } from '../../domain/money';
import {
  getAllocationAmountMinor,
  type ExpenseTransactionLinkAllocationDraft,
  type TransactionLinkAllocationDraft,
} from '../../domain/transactionLinkAllocationForm';
import {
  getTransactionLinkSourceOptionViews,
  getTransactionLinkTargetOptionViews,
  type ExpenseLinkTargetCandidateView,
  type IncomeLinkSourceCandidateView,
  type TransactionLinkSourceOptionView,
  type TransactionLinkTargetOptionView,
} from '../../domain/transactionLinkCandidateModel';
import type { TransactionLinkAllocationStatusContext } from '../../domain/transactionLinkAllocationStatus';
import { formatTransactionShortDate } from '../../domain/transactionDisplay';
import {
  getLinkedCounterpartDisplayForEndpoint,
  getTransactionLinkEndpointDisplay,
} from '../../domain/transactionLinking';
import type { AppSnapshot, Transaction, TransactionLinkBatchInput } from '../../domain/types';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import { LinkedTransactionIndicator } from './LinkedTransactionIndicator';
import { LinkAllocationAmountEditor } from './TransactionLinkControls';

export function AllocationRow({
  allocation,
  snapshot,
  onRemove,
  onChangeAmount,
  onUseMaximum,
}: {
  allocation: TransactionLinkAllocationDraft;
  snapshot: AppSnapshot;
  onRemove?: () => void;
  onChangeAmount: (amount: string) => void;
  onUseMaximum: () => void;
}) {
  const targetTransaction = snapshot.transactions.find((transaction) => transaction.id === allocation.targetTransactionId);
  const targetLine = allocation.targetLineId
    ? snapshot.transactionLines.find((line) => line.id === allocation.targetLineId)
    : undefined;
  const targetDisplay = getTransactionLinkEndpointDisplay({
    transactionId: allocation.targetTransactionId,
    lineId: allocation.targetLineId,
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    categories: snapshot.categories,
  });
  const title = targetDisplay.kind === 'missing' ? 'Linked item unavailable' : targetDisplay.title || targetTransaction?.title || 'Expense';
  const targetDetail = targetDisplay.kind === 'missing' ? 'Could not resolve linked expense' : targetDisplay.metadata || 'Whole transaction';

  return (
    <View style={styles.allocationRow}>
      <View style={styles.allocationHeader}>
        {targetLine ? <LineIcon line={targetLine} snapshot={snapshot} size="sm" /> : null}
        <View style={styles.allocationText}>
          <View style={styles.allocationTitleRow}>
            <LinkedTransactionIndicator compact />
            <Text numberOfLines={2} style={styles.allocationTitle}>{title}</Text>
          </View>
          <Text numberOfLines={1} style={styles.allocationMeta}>
            {targetDetail}{targetDisplay.dateLabel ? ` · ${targetDisplay.dateLabel}` : ''}
          </Text>
          <Text numberOfLines={2} style={styles.allocationDirection}>
            Toward {targetTransaction?.title || title}
          </Text>
          <Text numberOfLines={1} style={styles.allocationAmount}>
            {formatMoney(getAllocationAmountMinor(allocation), allocation.currencyCode)}
          </Text>
        </View>
      </View>
      <LinkAllocationAmountEditor
        amount={allocation.amount}
        currencyCode={allocation.currencyCode}
        quickActionLabel="Fill remaining"
        onChangeAmount={onChangeAmount}
        onRemove={onRemove}
        onUseMaximum={onUseMaximum}
      />
    </View>
  );
}

export function ExpenseAllocationRow({
  allocation,
  snapshot,
  targetTransaction,
  onRemove,
  onChangeAmount,
  onUseMaximum,
}: {
  allocation: ExpenseTransactionLinkAllocationDraft;
  snapshot: AppSnapshot;
  targetTransaction: Transaction;
  onRemove?: () => void;
  onChangeAmount: (amount: string) => void;
  onUseMaximum: () => void;
}) {
  const sourceTransaction = snapshot.transactions.find((transaction) => transaction.id === allocation.sourceTransactionId);
  const sourceLine = allocation.sourceLineId
    ? snapshot.transactionLines.find((line) => line.id === allocation.sourceLineId)
    : undefined;
  const sourceDisplay = getTransactionLinkEndpointDisplay({
    transactionId: allocation.sourceTransactionId,
    lineId: allocation.sourceLineId,
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    categories: snapshot.categories,
  });
  const title = sourceDisplay.kind === 'missing' ? 'Linked item unavailable' : sourceDisplay.title || sourceTransaction?.title || 'Income';
  const sourceDetail = sourceDisplay.kind === 'missing' ? 'Could not resolve linked income' : sourceDisplay.metadata || 'Whole transaction';

  return (
    <View style={styles.allocationRow}>
      <View style={styles.allocationHeader}>
        {sourceLine ? <LineIcon line={sourceLine} snapshot={snapshot} size="sm" /> : null}
        <View style={styles.allocationText}>
          <View style={styles.allocationTitleRow}>
            <LinkedTransactionIndicator compact />
            <Text numberOfLines={2} style={styles.allocationTitle}>{title}</Text>
          </View>
          <Text numberOfLines={1} style={styles.allocationMeta}>
            {sourceDetail}{sourceDisplay.dateLabel ? ` · ${sourceDisplay.dateLabel}` : ''}
          </Text>
          <Text numberOfLines={2} style={styles.allocationDirection}>
            Payment from {sourceTransaction?.title || title} toward {targetTransaction.title || 'expense'}
          </Text>
          <Text numberOfLines={1} style={styles.allocationAmount}>
            {formatMoney(getAllocationAmountMinor(allocation), allocation.currencyCode)}
          </Text>
        </View>
      </View>
      <LinkAllocationAmountEditor
        amount={allocation.amount}
        currencyCode={allocation.currencyCode}
        quickActionLabel="Use available"
        onChangeAmount={onChangeAmount}
        onRemove={onRemove}
        onUseMaximum={onUseMaximum}
      />
    </View>
  );
}

export function TargetCandidateOptions({
  candidate,
  snapshot,
  currencyCode,
  draftChanges,
  statusContext,
  onSelect,
}: {
  candidate: ExpenseLinkTargetCandidateView;
  snapshot: AppSnapshot;
  currencyCode: string;
  draftChanges: TransactionLinkBatchInput;
  statusContext: TransactionLinkAllocationStatusContext;
  onSelect: (option: TransactionLinkTargetOptionView) => void;
}) {
  const options = candidate.eligible
    ? getTransactionLinkTargetOptionViews({
        transaction: candidate.transaction,
        currencyCode,
        snapshot,
        draftChanges,
        statusContext,
      })
    : [
        {
          id: `${candidate.transaction.id}:disabled`,
          transaction: candidate.transaction,
          targetLineId: null,
          amountMinor: candidate.amountMinor,
          currencyCode: candidate.currencyCode,
          accountId: candidate.accountId,
          categoryId: candidate.categoryId,
          subcategoryId: candidate.subcategoryId,
          eligible: false,
          disabledReason: candidate.disabledReason,
          isLinked: candidate.isLinked,
          status: candidate.status,
        },
      ];
  const shouldFilterSplitOptions = !candidate.searchMatchesParent && candidate.searchMatchedLineIds.length > 0;
  const matchedLineIds = new Set(candidate.searchMatchedLineIds);
  const visibleOptions = shouldFilterSplitOptions
    ? options.filter((option) => !option.targetLineId || matchedLineIds.has(option.targetLineId))
    : options;

  return (
    <View style={styles.targetGroup}>
      {candidate.exactCapacityMatch ? <Text style={styles.bestMatchText}>Best match</Text> : null}
      {visibleOptions.map((option) => (
        <TargetOptionRow key={option.id} option={option} snapshot={snapshot} onPress={() => onSelect(option)} />
      ))}
    </View>
  );
}

export function SourceCandidateOptions({
  candidate,
  snapshot,
  currencyCode,
  draftChanges,
  statusContext,
  onSelect,
}: {
  candidate: IncomeLinkSourceCandidateView;
  snapshot: AppSnapshot;
  currencyCode: string;
  draftChanges: TransactionLinkBatchInput;
  statusContext: TransactionLinkAllocationStatusContext;
  onSelect: (option: TransactionLinkSourceOptionView) => void;
}) {
  const options = candidate.eligible
    ? getTransactionLinkSourceOptionViews({
        transaction: candidate.transaction,
        currencyCode,
        snapshot,
        draftChanges,
        statusContext,
      })
    : [
        {
          id: `${candidate.transaction.id}:disabled`,
          transaction: candidate.transaction,
          sourceLineId: null,
          amountMinor: candidate.amountMinor,
          currencyCode: candidate.currencyCode,
          accountId: candidate.accountId,
          eligible: false,
          disabledReason: candidate.disabledReason,
          isLinked: candidate.isLinked,
          status: candidate.status,
        },
      ];
  const shouldFilterSplitOptions = !candidate.searchMatchesParent && candidate.searchMatchedLineIds.length > 0;
  const matchedLineIds = new Set(candidate.searchMatchedLineIds);
  const visibleOptions = shouldFilterSplitOptions
    ? options.filter((option) => !option.sourceLineId || matchedLineIds.has(option.sourceLineId))
    : options;

  return (
    <View style={styles.targetGroup}>
      {candidate.exactCapacityMatch ? <Text style={styles.bestMatchText}>Best match</Text> : null}
      {visibleOptions.map((option) => (
        <SourceOptionRow key={option.id} option={option} snapshot={snapshot} onPress={() => onSelect(option)} />
      ))}
    </View>
  );
}

function TargetOptionRow({
  option,
  snapshot,
  onPress,
}: {
  option: TransactionLinkTargetOptionView;
  snapshot: AppSnapshot;
  onPress: () => void;
}) {
  const account = snapshot.accounts.find((item) => item.id === option.accountId);
  const targetDisplay = option.line
    ? getTransactionLinkEndpointDisplay({
        transactionId: option.transaction.id,
        lineId: option.targetLineId,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        categories: snapshot.categories,
      })
    : null;
  const title = targetDisplay?.title || option.transaction.title || 'Expense';
  const detail = targetDisplay?.metadata || option.line?.note || (account ? getAccountDisplayName(account) : option.disabledReason || 'Expense');
  const dateLabel = targetDisplay?.dateLabel || formatTransactionShortDate(option.transaction.datetime);
  const linkedDisplay = option.isLinked
    ? getLinkedCounterpartDisplayForEndpoint({
        endpoint: 'target',
        transactionId: option.transaction.id,
        lineId: option.targetLineId,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        categories: snapshot.categories,
      })
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!option.eligible}
      onPress={onPress}
      style={({ pressed }) => [
        styles.targetOptionRow,
        option.line && styles.targetOptionChild,
        option.isLinked && styles.linkedOptionRow,
        !option.eligible && styles.targetOptionDisabled,
        pressed && option.eligible && sharedStyles.pressed,
      ]}
    >
      <LineIcon line={option.line} snapshot={snapshot} fallbackCategoryId={option.categoryId} fallbackSubcategoryId={option.subcategoryId} size="sm" />
      <View style={styles.targetOptionText}>
        <Text numberOfLines={1} style={styles.targetOptionTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.targetOptionMeta}>
          {option.eligible ? `${detail} · ${formatTargetCapacity(option)}` : option.disabledReason}
        </Text>
        {linkedDisplay?.title ? (
          <LinkedItemMeta title={linkedDisplay.title} testID={`linked-target-option-detail-${option.id}`} />
        ) : null}
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.expenseAmount}>{formatMoney(option.amountMinor, option.currencyCode)}</Text>
        <Text style={styles.rowDate}>{dateLabel}</Text>
      </View>
    </Pressable>
  );
}

function SourceOptionRow({
  option,
  snapshot,
  onPress,
}: {
  option: TransactionLinkSourceOptionView;
  snapshot: AppSnapshot;
  onPress: () => void;
}) {
  const account = snapshot.accounts.find((item) => item.id === option.accountId);
  const sourceDisplay = option.line
    ? getTransactionLinkEndpointDisplay({
        transactionId: option.transaction.id,
        lineId: option.sourceLineId,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        categories: snapshot.categories,
      })
    : null;
  const title = sourceDisplay?.title || option.transaction.title || 'Income';
  const detail = sourceDisplay?.metadata || option.line?.note || (account ? getAccountDisplayName(account) : option.disabledReason || 'Income');
  const dateLabel = sourceDisplay?.dateLabel || formatTransactionShortDate(option.transaction.datetime);
  const linkedDisplay = option.isLinked
    ? getLinkedCounterpartDisplayForEndpoint({
        endpoint: 'source',
        transactionId: option.transaction.id,
        lineId: option.sourceLineId,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        categories: snapshot.categories,
      })
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!option.eligible}
      onPress={onPress}
      style={({ pressed }) => [
        styles.targetOptionRow,
        option.line && styles.targetOptionChild,
        option.isLinked && styles.linkedOptionRow,
        !option.eligible && styles.targetOptionDisabled,
        pressed && option.eligible && sharedStyles.pressed,
      ]}
    >
      {option.line ? <LineIcon line={option.line} snapshot={snapshot} size="sm" /> : <AccountIconBadge account={account} size="sm" />}
      <View style={styles.targetOptionText}>
        <Text numberOfLines={1} style={styles.targetOptionTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.targetOptionMeta}>
          {option.eligible ? `${detail} · ${formatSourceCapacity(option)}` : option.disabledReason}
        </Text>
        {linkedDisplay?.title ? (
          <LinkedItemMeta title={linkedDisplay.title} testID={`linked-source-option-detail-${option.id}`} />
        ) : null}
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.incomeAmount}>{formatMoney(option.amountMinor, option.currencyCode)}</Text>
        <Text style={styles.rowDate}>{dateLabel}</Text>
      </View>
    </Pressable>
  );
}

function LinkedItemMeta({ title, testID }: { title: string; testID: string }) {
  return (
    <View style={styles.linkedMetaRow} testID={testID}>
      <LinkedTransactionIndicator compact />
      <Text numberOfLines={1} style={styles.linkedDetailText}>{title}</Text>
    </View>
  );
}

function formatTargetCapacity(option: TransactionLinkTargetOptionView): string {
  if (option.status.allocatedMinor <= 0) return 'Unlinked';
  if (option.status.remainingMinor <= 0) return 'Settled';
  return `Linked ${formatMoney(option.status.allocatedMinor, option.currencyCode)} · ${formatMoney(option.status.remainingMinor, option.currencyCode)} left`;
}

function formatSourceCapacity(option: TransactionLinkSourceOptionView): string {
  if (option.status.allocatedMinor <= 0) return 'Unlinked';
  if (option.status.remainingMinor <= 0) return 'Settled';
  return `Used ${formatMoney(option.status.allocatedMinor, option.currencyCode)} · ${formatMoney(option.status.remainingMinor, option.currencyCode)} available`;
}

function LineIcon({
  line,
  snapshot,
  fallbackCategoryId = '',
  fallbackSubcategoryId = '',
  size = 'sm',
}: {
  line?: { categoryId: string; subcategoryId: string };
  snapshot: AppSnapshot;
  fallbackCategoryId?: string;
  fallbackSubcategoryId?: string;
  size?: 'sm' | 'md';
}) {
  const categoryId = line?.categoryId || fallbackCategoryId;
  const subcategoryId = line?.subcategoryId || fallbackSubcategoryId;
  const color = getSubcategoryColor(categoryId, subcategoryId, snapshot.categories);
  const icon = getSubcategoryIcon(categoryId, subcategoryId, snapshot.categories);

  return <CategoryIconBadge color={color} icon={icon} size={size} />;
}

const styles = StyleSheet.create({
  linkedOptionRow: {
    borderStyle: 'dashed',
  },
  linkedDetailText: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '800',
  },
  linkedMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minWidth: 0,
  },
  allocationRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  allocationHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  allocationText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  allocationTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
  },
  allocationTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minWidth: 0,
  },
  allocationMeta: {
    color: colors.muted,
    fontSize: typography.small,
  },
  allocationDirection: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '700',
  },
  allocationAmount: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  targetGroup: {
    gap: spacing.xs,
  },
  bestMatchText: {
    color: colors.success,
    fontSize: typography.small,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  targetOptionRow: {
    alignItems: 'center',
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  targetOptionChild: {
    marginLeft: spacing.lg,
  },
  targetOptionDisabled: {
    opacity: 0.5,
  },
  targetOptionText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  targetOptionTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  targetOptionMeta: {
    color: colors.muted,
    fontSize: typography.small,
  },
  rowEnd: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  rowDate: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  incomeAmount: {
    color: colors.success,
    fontSize: typography.body,
    fontWeight: '900',
  },
  expenseAmount: {
    color: colors.danger,
    fontSize: typography.body,
    fontWeight: '900',
  },
});
