import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '../../domain/money';
import {
  createTransactionLinkAllocationDrafts,
  formatMinorInput,
  getAllocatedAmountMinor,
  getTransactionLinkAllocationChanges,
  getTransactionLinkSourceScopes,
  type TransactionLinkAllocationDraft,
  type TransactionLinkTargetOption,
} from '../../domain/transactionLinkAllocationForm';
import {
  getExpenseLinkTargetCandidates,
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
import {
  transactionLinkTypeOptions,
} from './TransactionLinkLabels';
import {
  AllocationRow,
  SourceScopeRow,
  SummaryItem,
  TargetCandidateOptions,
} from './IncomeLinkManagerRows';

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
