import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { getAccountDisplayName } from '../../domain/accountThemes';
import {
  getCategory,
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import { formatMoney } from '../../domain/money';
import {
  createTransactionLinkAllocationDrafts,
  formatMinorInput,
  getAllocatedAmountMinor,
  getAllocationAmountMinor,
  getTransactionLinkAllocationChanges,
  getTransactionLinkSourceScopes,
  getTransactionLinkTargetOptions,
  type TransactionLinkAllocationDraft,
  type TransactionLinkSourceScope,
  type TransactionLinkTargetOption,
} from '../../domain/transactionLinkAllocationForm';
import { formatTransactionShortDate } from '../../domain/transactionDisplay';
import {
  getExpenseLinkTargetCandidates,
  getLinkedCounterpartDisplayLabelForEndpoint,
  type ExpenseLinkTargetCandidate,
} from '../../domain/transactionLinking';
import type {
  AppSnapshot,
  NewTransactionLinkInput,
  Transaction,
  TransactionLinkType,
  UpdateTransactionLinkInput,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { InlineField } from './TransactionFormComponents';
import { LinkedTransactionIndicator } from './LinkedTransactionIndicator';
import {
  getTransactionLinkTypeShortLabel,
  transactionLinkTypeOptions,
} from './TransactionLinkLabels';

type IncomeLinkManagerProps = {
  snapshot: AppSnapshot;
  transaction: Transaction;
  onAddTransactionLink: (input: NewTransactionLinkInput) => Promise<void>;
  onUpdateTransactionLink: (input: UpdateTransactionLinkInput) => Promise<void>;
  onDeleteTransactionLink: (linkId: string) => Promise<void>;
  onError: (message: string) => void;
};

export function IncomeLinkManager({
  snapshot,
  transaction,
  onAddTransactionLink,
  onUpdateTransactionLink,
  onDeleteTransactionLink,
  onError,
}: IncomeLinkManagerProps) {
  const [linkType, setLinkType] = useState<TransactionLinkType>('reimbursement');
  const [selectedSourceScopeId, setSelectedSourceScopeId] = useState('source:whole');
  const [query, setQuery] = useState('');
  const [allocations, setAllocations] = useState<TransactionLinkAllocationDraft[]>(() =>
    createTransactionLinkAllocationDrafts(transaction.id, snapshot.transactionLinks),
  );
  const [saving, setSaving] = useState(false);
  const sourceScopes = useMemo(
    () => getTransactionLinkSourceScopes(transaction, snapshot.transactionLines, snapshot.transactionLinks),
    [snapshot.transactionLines, snapshot.transactionLinks, transaction],
  );
  const selectedSourceScope =
    sourceScopes.find((scope) => scope.id === selectedSourceScopeId) ?? sourceScopes[0];
  const allocatedMinor = selectedSourceScope
    ? getAllocatedAmountMinor(allocations, selectedSourceScope.sourceLineId)
    : 0;
  const remainingMinor = Math.max(0, (selectedSourceScope?.amountMinor ?? 0) - allocatedMinor);
  const candidates = useMemo(
    () =>
      getExpenseLinkTargetCandidates({
        sourceTransactionId: transaction.id,
        sourceCurrencyCode: selectedSourceScope?.currencyCode ?? null,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        query,
      }).slice(0, 12),
    [
      query,
      selectedSourceScope?.currencyCode,
      snapshot.transactionLines,
      snapshot.transactionLinks,
      snapshot.transactions,
      transaction.id,
    ],
  );

  useEffect(() => {
    setAllocations(createTransactionLinkAllocationDrafts(transaction.id, snapshot.transactionLinks));
  }, [snapshot.transactionLinks, transaction.id]);

  useEffect(() => {
    if (sourceScopes.length && !sourceScopes.some((scope) => scope.id === selectedSourceScopeId)) {
      setSelectedSourceScopeId(sourceScopes[0].id);
    }
  }, [selectedSourceScopeId, sourceScopes]);

  function updateAllocation(allocationId: string, patch: Partial<TransactionLinkAllocationDraft>) {
    setAllocations((current) =>
      current.map((allocation) => (allocation.id === allocationId ? { ...allocation, ...patch } : allocation)),
    );
  }

  function removeAllocation(allocationId: string) {
    setAllocations((current) => current.filter((allocation) => allocation.id !== allocationId));
  }

  function addAllocation(option: TransactionLinkTargetOption) {
    if (!selectedSourceScope) {
      onError('This income transaction needs a positive amount before linking.');
      return;
    }

    if (!option.eligible) {
      onError(option.disabledReason || 'This expense cannot be linked.');
      return;
    }

    const duplicate = allocations.some(
      (allocation) =>
        allocation.sourceLineId === selectedSourceScope.sourceLineId &&
        allocation.targetTransactionId === option.transaction.id &&
        allocation.targetLineId === option.targetLineId &&
        allocation.linkType === linkType,
    );
    if (duplicate) {
      onError('This allocation is already listed.');
      return;
    }

    const amountMinor = Math.min(remainingMinor, option.amountMinor);
    if (amountMinor <= 0) {
      onError('No unallocated source amount remains for this selection.');
      return;
    }

    setAllocations((current) => [
      ...current,
      {
        id: `draft-${Date.now()}-${option.id}`,
        sourceLineId: selectedSourceScope.sourceLineId,
        targetTransactionId: option.transaction.id,
        targetLineId: option.targetLineId,
        linkType,
        amount: formatMinorInput(amountMinor),
        currencyCode: option.currencyCode,
      },
    ]);
    onError('');
  }

  async function saveAllocations() {
    setSaving(true);
    try {
      const changes = getTransactionLinkAllocationChanges({
        sourceTransactionId: transaction.id,
        existingLinks: snapshot.transactionLinks,
        allocations,
      });

      for (const linkId of changes.deleteIds) {
        await onDeleteTransactionLink(linkId);
      }
      for (const input of changes.toUpdate) {
        await onUpdateTransactionLink(input);
      }
      for (const input of changes.toAdd) {
        await onAddTransactionLink(input);
      }
      onError('');
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Could not save transaction links.');
    } finally {
      setSaving(false);
    }
  }

  if (!selectedSourceScope) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This income transaction needs a positive amount before linking.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allocate this incoming money</Text>
        <View style={styles.summaryRow}>
          <SummaryItem label="Source" value={formatMoney(selectedSourceScope.amountMinor, selectedSourceScope.currencyCode)} />
          <SummaryItem label="Allocated" value={formatMoney(allocatedMinor, selectedSourceScope.currencyCode)} />
          <SummaryItem label="Remaining" value={formatMoney(remainingMinor, selectedSourceScope.currencyCode)} />
        </View>

        {sourceScopes.length > 1 ? (
          <View style={styles.optionList}>
            <Text style={styles.selectedLabel}>Source</Text>
            {sourceScopes.map((scope) => (
              <SourceScopeRow
                key={scope.id}
                scope={scope}
                snapshot={snapshot}
                sourceTransaction={transaction}
                selected={scope.id === selectedSourceScope.id}
                onPress={() => setSelectedSourceScopeId(scope.id)}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allocations</Text>
        {allocations.length ? (
          <View style={styles.allocationList}>
            {allocations.map((allocation) => (
              <AllocationRow
                key={allocation.id}
                allocation={allocation}
                snapshot={snapshot}
                sourceTransaction={transaction}
                onChangeAmount={(amount) => updateAllocation(allocation.id, { amount })}
                onRemove={() => removeAllocation(allocation.id)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No allocations yet.</Text>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={saveAllocations}
          style={({ pressed }) => [styles.saveButton, (pressed || saving) && styles.pressed]}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save allocations'}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add allocation</Text>
        <View style={styles.optionList}>
          {transactionLinkTypeOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => setLinkType(option.value)}
              style={({ pressed }) => [
                styles.treatmentOption,
                linkType === option.value && styles.treatmentOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.radio, linkType === option.value && styles.radioSelected]} />
              <Text style={[styles.optionText, linkType === option.value && styles.optionTextSelected]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <InlineField label="Find expense" value={query} onChange={setQuery} placeholder="Search by item, category, currency" />
        <View style={styles.searchResults}>
          {candidates.map((candidate) => (
            <TargetCandidateOptions
              key={candidate.transaction.id}
              candidate={candidate}
              snapshot={snapshot}
              currencyCode={selectedSourceScope.currencyCode}
              onSelect={addAllocation}
            />
          ))}
          {!candidates.length ? <Text style={styles.emptyText}>No matching expenses.</Text> : null}
        </View>
      </View>
    </>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function SourceScopeRow({
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
  const label = scope.line ? getLineLabel(scope.line, snapshot) : 'Whole income transaction';
  const detail = scope.line?.note || (account ? getAccountDisplayName(account) : 'All income lines');
  const linkedDetail = scope.isLinked
    ? getLinkedCounterpartDisplayLabelForEndpoint({
        endpoint: 'source',
        transactionId: sourceTransaction.id,
        lineId: scope.sourceLineId,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        categories: snapshot.categories,
      })
    : '';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.scopeRow,
        selected && styles.scopeRowSelected,
        scope.isLinked && styles.linkedOptionRow,
        pressed && styles.pressed,
      ]}
    >
      {scope.line ? <LineIcon line={scope.line} snapshot={snapshot} size="sm" /> : null}
      <View style={styles.scopeText}>
        <Text numberOfLines={1} style={styles.scopeTitle}>{label}</Text>
        <Text numberOfLines={1} style={styles.scopeMeta}>{detail}</Text>
        {linkedDetail ? (
          <Text numberOfLines={1} style={styles.linkedDetailText}>Linked to {linkedDetail}</Text>
        ) : null}
      </View>
      <View style={styles.rowEnd}>
        {scope.isLinked ? (
          <LinkedTransactionIndicator
            label
            labelText="Already linked"
            testID={`linked-source-scope-${scope.id}`}
          />
        ) : null}
        <Text style={styles.incomeAmount}>{formatMoney(scope.amountMinor, scope.currencyCode)}</Text>
      </View>
    </Pressable>
  );
}

function AllocationRow({
  allocation,
  snapshot,
  sourceTransaction,
  onChangeAmount,
  onRemove,
}: {
  allocation: TransactionLinkAllocationDraft;
  snapshot: AppSnapshot;
  sourceTransaction: Transaction;
  onChangeAmount: (amount: string) => void;
  onRemove: () => void;
}) {
  const targetTransaction = snapshot.transactions.find((transaction) => transaction.id === allocation.targetTransactionId);
  const targetLine = allocation.targetLineId
    ? snapshot.transactionLines.find((line) => line.id === allocation.targetLineId)
    : undefined;
  const sourceLine = allocation.sourceLineId
    ? snapshot.transactionLines.find((line) => line.id === allocation.sourceLineId)
    : undefined;
  const title = targetTransaction?.title || 'Expense';
  const targetDetail = targetLine ? getLineLabel(targetLine, snapshot) : 'Whole transaction';
  const sourceDetail = sourceLine ? getLineLabel(sourceLine, snapshot) : sourceTransaction.title || 'Whole income';

  return (
    <View style={styles.allocationRow}>
      <View style={styles.allocationHeader}>
        {targetLine ? <LineIcon line={targetLine} snapshot={snapshot} size="sm" /> : null}
        <View style={styles.allocationText}>
          <Text numberOfLines={1} style={styles.allocationTitle}>{title}</Text>
          <Text numberOfLines={1} style={styles.allocationMeta}>
            {targetDetail} / From {sourceDetail} / {getTransactionLinkTypeShortLabel(allocation.linkType)}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onRemove}
          style={({ pressed }) => [styles.smallDangerButton, pressed && styles.pressed]}
        >
          <Text style={styles.smallDangerText}>Remove</Text>
        </Pressable>
      </View>
      <InlineField
        label="Amount"
        value={allocation.amount}
        onChange={onChangeAmount}
        placeholder="0.00"
        keyboardType="decimal-pad"
        rightLabel={formatMoney(getAllocationAmountMinor(allocation), allocation.currencyCode)}
      />
    </View>
  );
}

function TargetCandidateOptions({
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
      <Text numberOfLines={1} style={styles.targetGroupTitle}>
        {candidate.transaction.title || 'Expense'} / {formatTransactionShortDate(candidate.transaction.datetime)}
      </Text>
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
  const title = option.line ? getLineLabel(option.line, snapshot) : 'Whole transaction';
  const detail = option.line?.note || (account ? getAccountDisplayName(account) : option.disabledReason || 'Expense');
  const linkedDetail = option.isLinked
    ? getLinkedCounterpartDisplayLabelForEndpoint({
        endpoint: 'target',
        transactionId: option.transaction.id,
        lineId: option.targetLineId,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        categories: snapshot.categories,
      })
    : '';

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
        pressed && option.eligible && styles.pressed,
      ]}
    >
      <LineIcon line={option.line} snapshot={snapshot} fallbackCategoryId={option.categoryId} fallbackSubcategoryId={option.subcategoryId} size="sm" />
      <View style={styles.targetOptionText}>
        <Text numberOfLines={1} style={styles.targetOptionTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.targetOptionMeta}>
          {option.eligible ? detail : option.disabledReason}
        </Text>
        {linkedDetail ? (
          <Text numberOfLines={1} style={styles.linkedDetailText}>Linked to {linkedDetail}</Text>
        ) : null}
      </View>
      <View style={styles.rowEnd}>
        {option.isLinked ? (
          <LinkedTransactionIndicator
            label
            labelText="Already linked"
            testID={`linked-target-option-${option.id}`}
          />
        ) : null}
        <Text style={styles.expenseAmount}>{formatMoney(option.amountMinor, option.currencyCode)}</Text>
      </View>
    </Pressable>
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

function getLineLabel(line: { categoryId: string; subcategoryId: string }, snapshot: AppSnapshot): string {
  const category = getCategory(line.categoryId, snapshot.categories);
  return getSubcategoryName(line.categoryId, line.subcategoryId, snapshot.categories) || category.name || 'Split line';
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  summaryItem: {
    backgroundColor: colors.background,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
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
    fontSize: typography.small,
    fontWeight: '900',
  },
  optionList: {
    gap: spacing.xs,
  },
  treatmentOption: {
    alignItems: 'center',
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  treatmentOptionSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  radio: {
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  radioSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '800',
  },
  optionTextSelected: {
    color: colors.primaryDark,
  },
  selectedLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  scopeRow: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  scopeRowSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  linkedOptionRow: {
    borderColor: colors.primary,
  },
  scopeText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  scopeTitle: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  scopeMeta: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  linkedDetailText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '800',
  },
  allocationList: {
    gap: spacing.sm,
  },
  allocationRow: {
    backgroundColor: colors.background,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
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
    gap: spacing.xs,
    minWidth: 0,
  },
  allocationTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  allocationMeta: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  searchResults: {
    gap: spacing.sm,
  },
  targetGroup: {
    gap: spacing.xs,
  },
  targetGroupTitle: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '900',
  },
  targetOptionRow: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  targetOptionChild: {
    marginLeft: spacing.md,
  },
  targetOptionDisabled: {
    opacity: 0.55,
  },
  targetOptionText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  targetOptionTitle: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  targetOptionMeta: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  rowEnd: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: spacing.xs,
  },
  incomeAmount: {
    color: colors.success,
    fontSize: typography.small,
    fontWeight: '900',
  },
  expenseAmount: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '900',
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  saveButtonText: {
    color: colors.surface,
    fontSize: typography.body,
    fontWeight: '900',
  },
  smallDangerButton: {
    alignItems: 'center',
    borderColor: '#E4C3C3',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  smallDangerText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
