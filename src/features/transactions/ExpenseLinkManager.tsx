import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../domain/money';
import {
  createExpenseTransactionLinkAllocationDrafts,
  formatMinorInput,
  getExpenseTransactionLinkAllocationChanges,
  getTargetAllocatedAmountMinor,
  getTransactionLinkTargetScopes,
  type ExpenseTransactionLinkAllocationDraft,
  type TransactionLinkSourceOption,
} from '../../domain/transactionLinkAllocationForm';
import { getIncomeLinkSourceCandidates } from '../../domain/transactionLinking';
import type {
  AppSnapshot,
  Transaction,
  TransactionLinkBatchInput,
  TransactionLinkType,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  ExpenseAllocationRow,
  SourceCandidateOptions,
  SummaryItem,
  TargetScopeRow,
} from './IncomeLinkManagerRows';
import { InlineField } from './TransactionFormComponents';
import { transactionLinkTypeOptions } from './TransactionLinkLabels';

type ExpenseLinkManagerProps = {
  snapshot: AppSnapshot;
  transaction: Transaction;
  onSaveTransactionLinkBatch: (input: TransactionLinkBatchInput) => Promise<void>;
  onDone: () => void;
  onError: (message: string) => void;
};

export function ExpenseLinkManager({
  snapshot,
  transaction,
  onSaveTransactionLinkBatch,
  onDone,
  onError,
}: ExpenseLinkManagerProps) {
  const [linkType, setLinkType] = useState<TransactionLinkType>('refund');
  const [selectedTargetScopeId, setSelectedTargetScopeId] = useState('target:whole');
  const [query, setQuery] = useState('');
  const [allocations, setAllocations] = useState<ExpenseTransactionLinkAllocationDraft[]>(() =>
    createExpenseTransactionLinkAllocationDrafts(transaction.id, snapshot.transactionLinks),
  );
  const [saving, setSaving] = useState(false);
  const targetScopes = useMemo(
    () => getTransactionLinkTargetScopes(transaction, snapshot.transactionLines, snapshot.transactionLinks),
    [snapshot.transactionLines, snapshot.transactionLinks, transaction],
  );
  const selectedTargetScope =
    targetScopes.find((scope) => scope.id === selectedTargetScopeId) ?? targetScopes[0];
  const allocatedMinor = selectedTargetScope
    ? getTargetAllocatedAmountMinor(allocations, selectedTargetScope.targetLineId)
    : 0;
  const remainingMinor = Math.max(0, (selectedTargetScope?.amountMinor ?? 0) - allocatedMinor);
  const candidates = useMemo(
    () =>
      getIncomeLinkSourceCandidates({
        targetTransactionId: transaction.id,
        targetCurrencyCode: selectedTargetScope?.currencyCode ?? null,
        transactions: snapshot.transactions,
        lines: snapshot.transactionLines,
        transactionLinks: snapshot.transactionLinks,
        categories: snapshot.categories,
        query,
      }).slice(0, 12),
    [
      query,
      selectedTargetScope?.currencyCode,
      snapshot.categories,
      snapshot.transactionLines,
      snapshot.transactionLinks,
      snapshot.transactions,
      transaction.id,
    ],
  );

  useEffect(() => {
    setAllocations(createExpenseTransactionLinkAllocationDrafts(transaction.id, snapshot.transactionLinks));
  }, [snapshot.transactionLinks, transaction.id]);

  useEffect(() => {
    if (targetScopes.length && !targetScopes.some((scope) => scope.id === selectedTargetScopeId)) {
      setSelectedTargetScopeId(targetScopes[0].id);
    }
  }, [selectedTargetScopeId, targetScopes]);

  function removeAllocation(allocationId: string) {
    setAllocations((current) => current.filter((allocation) => allocation.id !== allocationId));
  }

  function addAllocation(option: TransactionLinkSourceOption) {
    if (!selectedTargetScope) {
      onError('This expense transaction needs a negative amount before linking.');
      return;
    }

    if (!option.eligible) {
      onError(option.disabledReason || 'This income cannot be linked.');
      return;
    }

    const duplicate = allocations.some(
      (allocation) =>
        allocation.sourceTransactionId === option.transaction.id &&
        allocation.sourceLineId === option.sourceLineId &&
        allocation.targetLineId === selectedTargetScope.targetLineId &&
        allocation.linkType === linkType,
    );
    if (duplicate) {
      onError('This allocation is already listed.');
      return;
    }

    const amountMinor = Math.min(remainingMinor, option.amountMinor);
    if (amountMinor <= 0) {
      onError('No unallocated expense amount remains for this selection.');
      return;
    }

    setAllocations((current) => [
      ...current,
      {
        id: `draft-${Date.now()}-${option.id}`,
        sourceTransactionId: option.transaction.id,
        sourceLineId: option.sourceLineId,
        targetLineId: selectedTargetScope.targetLineId,
        linkType,
        amount: formatMinorInput(amountMinor),
        currencyCode: option.currencyCode,
      },
    ]);
    onError('');
  }

  async function saveAllocations() {
    setSaving(true);
    let shouldClose = false;
    try {
      const changes = getExpenseTransactionLinkAllocationChanges({
        targetTransactionId: transaction.id,
        existingLinks: snapshot.transactionLinks,
        allocations,
      });

      await onSaveTransactionLinkBatch(changes);
      onError('');
      shouldClose = true;
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Could not save transaction links.');
    } finally {
      setSaving(false);
      if (shouldClose) {
        onDone();
      }
    }
  }

  if (!selectedTargetScope) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This expense transaction needs a negative amount before linking.</Text>
      </View>
    );
  }

  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Allocate money received for this expense</Text>
        <View style={styles.summaryRow}>
          <SummaryItem label="Expense" value={formatMoney(selectedTargetScope.amountMinor, selectedTargetScope.currencyCode)} />
          <SummaryItem label="Linked" value={formatMoney(allocatedMinor, selectedTargetScope.currencyCode)} />
          <SummaryItem label="Remaining" value={formatMoney(remainingMinor, selectedTargetScope.currencyCode)} />
        </View>

        {targetScopes.length > 1 ? (
          <View style={styles.optionList}>
            <Text style={styles.selectedLabel}>Expense scope</Text>
            {targetScopes.map((scope) => (
              <TargetScopeRow
                key={scope.id}
                scope={scope}
                snapshot={snapshot}
                targetTransaction={transaction}
                selected={scope.id === selectedTargetScope.id}
                onPress={() => setSelectedTargetScopeId(scope.id)}
              />
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Linked money received</Text>
        {allocations.length ? (
          <View style={styles.allocationList}>
            {allocations.map((allocation) => (
              <ExpenseAllocationRow
                key={allocation.id}
                allocation={allocation}
                snapshot={snapshot}
                targetTransaction={transaction}
                onRemove={() => removeAllocation(allocation.id)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No linked income yet.</Text>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={saveAllocations}
          style={({ pressed }) => [styles.saveButton, (pressed || saving) && styles.pressed]}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save links'}</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add income link</Text>
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
        <InlineField label="Find income" value={query} onChange={setQuery} placeholder="Search by item or currency" />
        <View style={styles.searchResults}>
          {candidates.map((candidate) => (
            <SourceCandidateOptions
              key={candidate.transaction.id}
              candidate={candidate}
              snapshot={snapshot}
              currencyCode={selectedTargetScope.currencyCode}
              onSelect={addAllocation}
            />
          ))}
          {!candidates.length ? <Text style={styles.emptyText}>No matching income transactions.</Text> : null}
        </View>
      </View>
    </>
  );
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
  allocationList: {
    gap: spacing.sm,
  },
  searchResults: {
    gap: spacing.sm,
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
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
