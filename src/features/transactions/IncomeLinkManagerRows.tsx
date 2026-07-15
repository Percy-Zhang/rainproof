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
import type { AppSnapshot, TransactionLinkBatchInput } from '../../domain/types';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import { LinkedTransactionIndicator } from './LinkedTransactionIndicator';

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
    ? options.filter((option) => !!option.targetLineId && matchedLineIds.has(option.targetLineId))
    : options;

  return (
    <View style={styles.targetGroup}>
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
    ? options.filter((option) => !!option.sourceLineId && matchedLineIds.has(option.sourceLineId))
    : options;

  return (
    <View style={styles.targetGroup}>
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
        <Text numberOfLines={1} style={styles.targetOptionMeta}>{option.eligible ? detail : option.disabledReason}</Text>
        {option.status.status === 'settled' ? (
          <View style={styles.linkedMetaRow} testID={`settled-target-option-${option.id}`}>
            <LinkedTransactionIndicator compact />
            <Text style={styles.linkedDetailText}>Settled</Text>
          </View>
        ) : option.status.remainingMinor > 0 ? (
          <Text numberOfLines={1} style={styles.capacityText}>{formatTargetCapacity(option)}</Text>
        ) : null}
        {option.status.status !== 'settled' && linkedDisplay?.title ? (
          <LinkedItemMeta title={linkedDisplay.title} testID={`linked-target-option-detail-${option.id}`} />
        ) : null}
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.expenseAmount}>-{formatMoney(option.amountMinor, option.currencyCode)}</Text>
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
        <Text numberOfLines={1} style={styles.targetOptionMeta}>{option.eligible ? detail : option.disabledReason}</Text>
        {option.status.status === 'settled' ? (
          <View style={styles.linkedMetaRow} testID={`settled-source-option-${option.id}`}>
            <LinkedTransactionIndicator compact />
            <Text style={styles.linkedDetailText}>Settled</Text>
          </View>
        ) : option.status.remainingMinor > 0 ? (
          <Text numberOfLines={1} style={styles.capacityText}>{formatSourceCapacity(option)}</Text>
        ) : null}
        {option.status.status !== 'settled' && linkedDisplay?.title ? (
          <LinkedItemMeta title={linkedDisplay.title} testID={`linked-source-option-detail-${option.id}`} />
        ) : null}
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.incomeAmount}>+{formatMoney(option.amountMinor, option.currencyCode)}</Text>
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
  if (option.status.remainingMinor <= 0) return 'Settled';
  return `Remaining ${formatMoney(option.status.remainingMinor, option.currencyCode)}`;
}

function formatSourceCapacity(option: TransactionLinkSourceOptionView): string {
  if (option.status.remainingMinor <= 0) return 'Settled';
  return `Remaining ${formatMoney(option.status.remainingMinor, option.currencyCode)}`;
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
  capacityText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '800',
  },
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
  targetGroup: {
    gap: spacing.xs,
  },
  targetOptionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
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
    flex: 1,
    fontSize: typography.body,
    fontWeight: '900',
    minWidth: 0,
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
