import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { getAccountDisplayName } from '../../domain/accountThemes';
import {
  getSubcategoryColor,
  getSubcategoryIcon,
} from '../../domain/categories';
import { formatMoney } from '../../domain/money';
import {
  getAllocationAmountMinor,
  getTransactionLinkTargetOptions,
  type TransactionLinkAllocationDraft,
  type TransactionLinkSourceScope,
  type TransactionLinkTargetOption,
} from '../../domain/transactionLinkAllocationForm';
import { formatTransactionShortDate } from '../../domain/transactionDisplay';
import {
  getLinkedCounterpartDisplayForEndpoint,
  getTransactionLinkEndpointDisplay,
  type ExpenseLinkTargetCandidate,
} from '../../domain/transactionLinking';
import type { AppSnapshot, Transaction } from '../../domain/types';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import { LinkedTransactionIndicator } from './LinkedTransactionIndicator';
import { getTransactionLinkTypeShortLabel } from './TransactionLinkLabels';

export function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export function SourceScopeRow({
  scope,
  snapshot,
  sourceTransaction,
  selected,
  onPress,
}: {
  scope: TransactionLinkSourceScope;
  snapshot: AppSnapshot;
  sourceTransaction: Transaction;
  selected: boolean;
  onPress: () => void;
}) {
  const account = scope.line ? snapshot.accounts.find((item) => item.id === scope.line?.accountId) : undefined;
  const sourceDisplay = scope.line
    ? getTransactionLinkEndpointDisplay({
        transactionId: sourceTransaction.id,
        lineId: scope.sourceLineId,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        categories: snapshot.categories,
      })
    : null;
  const label = sourceDisplay?.title || 'Whole income transaction';
  const detail = sourceDisplay?.metadata || scope.line?.note || (account ? getAccountDisplayName(account) : 'All income lines');
  const dateLabel = sourceDisplay?.dateLabel || formatTransactionShortDate(sourceTransaction.datetime);
  const linkedDisplay = scope.isLinked
    ? getLinkedCounterpartDisplayForEndpoint({
        endpoint: 'source',
        transactionId: sourceTransaction.id,
        lineId: scope.sourceLineId,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        categories: snapshot.categories,
      })
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.scopeRow,
        selected && styles.scopeRowSelected,
        scope.isLinked && styles.linkedOptionRow,
        pressed && sharedStyles.pressed,
      ]}
    >
      {scope.line ? <LineIcon line={scope.line} snapshot={snapshot} size="sm" /> : null}
      <View style={styles.scopeText}>
        <Text numberOfLines={1} style={styles.scopeTitle}>{label}</Text>
        <Text numberOfLines={1} style={styles.scopeMeta}>{detail}</Text>
        {linkedDisplay?.title ? (
          <LinkedItemMeta title={linkedDisplay.title} testID={`linked-source-scope-detail-${scope.id}`} />
        ) : null}
      </View>
      <View style={styles.rowEnd}>
        <Text style={styles.incomeAmount}>{formatMoney(scope.amountMinor, scope.currencyCode)}</Text>
        <Text style={styles.rowDate}>{dateLabel}</Text>
      </View>
    </Pressable>
  );
}

export function AllocationRow({
  allocation,
  snapshot,
  sourceTransaction,
  onRemove,
}: {
  allocation: TransactionLinkAllocationDraft;
  snapshot: AppSnapshot;
  sourceTransaction: Transaction;
  onRemove: () => void;
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
  const sourceDisplay = getTransactionLinkEndpointDisplay({
    transactionId: sourceTransaction.id,
    lineId: allocation.sourceLineId,
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    categories: snapshot.categories,
  });
  const title = targetDisplay.kind === 'missing' ? 'Linked item unavailable' : targetDisplay.title || targetTransaction?.title || 'Expense';
  const targetDetail = targetDisplay.kind === 'missing' ? 'Could not resolve linked expense' : targetDisplay.metadata || 'Whole transaction';
  const sourceDetail = sourceDisplay.kind === 'missing' ? 'income unavailable' : sourceDisplay.label || sourceTransaction.title || 'Whole income';

  return (
    <View style={styles.allocationRow}>
      <View style={styles.allocationHeader}>
        {targetLine ? <LineIcon line={targetLine} snapshot={snapshot} size="sm" /> : null}
        <View style={styles.allocationText}>
          <View style={styles.allocationTitleRow}>
            <LinkedTransactionIndicator compact />
            <Text numberOfLines={1} style={styles.allocationTitle}>{title}</Text>
          </View>
          <Text numberOfLines={1} style={styles.allocationMeta}>
            {targetDetail} / From {sourceDetail} / {getTransactionLinkTypeShortLabel(allocation.linkType)}
          </Text>
          <Text numberOfLines={1} style={styles.allocationAmount}>
            {formatMoney(getAllocationAmountMinor(allocation), allocation.currencyCode)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onRemove}
          style={({ pressed }) => [styles.smallDangerButton, pressed && sharedStyles.pressed]}
        >
          <Text style={styles.smallDangerText}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function TargetCandidateOptions({
  candidate,
  snapshot,
  currencyCode,
  onSelect,
}: {
  candidate: ExpenseLinkTargetCandidate;
  snapshot: AppSnapshot;
  currencyCode: string;
  onSelect: (option: TransactionLinkTargetOption) => void;
}) {
  const options = candidate.eligible
    ? getTransactionLinkTargetOptions({
        transaction: candidate.transaction,
        lines: snapshot.transactionLines,
        currencyCode,
        transactionLinks: snapshot.transactionLinks,
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
        },
      ];

  return (
    <View style={styles.targetGroup}>
      {options.map((option) => (
        <TargetOptionRow key={option.id} option={option} snapshot={snapshot} onPress={() => onSelect(option)} />
      ))}
    </View>
  );
}

function TargetOptionRow({
  option,
  snapshot,
  onPress,
}: {
  option: TransactionLinkTargetOption;
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
          {option.eligible ? detail : option.disabledReason}
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

function LinkedItemMeta({ title, testID }: { title: string; testID: string }) {
  return (
    <View style={styles.linkedMetaRow} testID={testID}>
      <LinkedTransactionIndicator compact />
      <Text numberOfLines={1} style={styles.linkedDetailText}>{title}</Text>
    </View>
  );
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
  summaryItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  scopeRow: {
    alignItems: 'center',
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  scopeRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  linkedOptionRow: {
    borderStyle: 'dashed',
  },
  scopeText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  scopeTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  scopeMeta: {
    color: colors.muted,
    fontSize: typography.small,
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
  allocationAmount: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  targetGroup: {
    gap: spacing.xs,
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
  smallDangerButton: {
    alignItems: 'center',
    borderColor: colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  smallDangerText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '900',
  },
});
