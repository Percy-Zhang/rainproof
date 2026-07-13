import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getAccountDisplayName } from '../../domain/accountThemes';
import { formatMoney } from '../../domain/money';
import {
  createTransactionLinkAllocationDrafts,
  formatMinorInput,
  getAllocationAmountMinor,
  getTransactionLinkAllocationDraftStatusChanges,
  getTransactionLinkAllocationChanges,
  isValidTransactionLinkAllocationAmount,
  type TransactionLinkAllocationDraft,
} from '../../domain/transactionLinkAllocationForm';
import {
  TRANSACTION_LINK_CANDIDATE_PAGE_SIZE,
  filterPreparedExpenseLinkTargetCandidateViews,
  getDefaultLinkAllocationAmountMinor,
  getLinkAllocationEditableMaximumMinor,
  getTransactionLinkSourceScopeViews,
  getTransactionLinkTargetOptionViews,
  prepareExpenseLinkTargetCandidateViews,
  type ExpenseLinkTargetCandidateView,
  type TransactionLinkTargetOptionView,
} from '../../domain/transactionLinkCandidateModel';
import {
  createTransactionLinkAllocationStatusContext,
  getTransactionLineLinkAllocationStatus,
  getTransactionLinkAllocationStatus,
  type ScopedTransactionLinkAllocationStatus,
} from '../../domain/transactionLinkAllocationStatus';
import { formatTransactionShortDate } from '../../domain/transactionDisplay';
import { getTransactionLinkEndpointDisplay } from '../../domain/transactionLinking';
import type { AppSnapshot, Transaction, TransactionLinkBatchInput } from '../../domain/types';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import { AllocationRow, TargetCandidateOptions } from './IncomeLinkManagerRows';
import { InlineField } from './TransactionFormComponents';
import { LinkAllocationSummary, TransactionLinkCandidateFilterControl } from './TransactionLinkControls';
import {
  LinkCandidateRow,
  LinkFlowHeader,
  LinkOverviewAllocationRow,
  LinkOverviewGroup,
  LinkPrimaryButton,
} from './TransactionLinkFlowViews';
import { useTransactionLinkCandidateDiscovery } from './useTransactionLinkCandidateDiscovery';

type IncomeLinkManagerProps = {
  snapshot: AppSnapshot;
  transaction: Transaction;
  onSaveTransactionLinkBatch: (input: TransactionLinkBatchInput) => Promise<void>;
  onDone: () => void;
  onError: (message: string) => void;
};

type LinkFlowStage = 'overview' | 'current-scope' | 'find' | 'candidate-scope' | 'editor';

export function IncomeLinkManager({
  snapshot,
  transaction,
  onSaveTransactionLinkBatch,
  onDone,
  onError,
}: IncomeLinkManagerProps) {
  const [stage, setStage] = useState<LinkFlowStage>('overview');
  const [selectedSourceScopeId, setSelectedSourceScopeId] = useState('source:whole');
  const [selectedCandidate, setSelectedCandidate] = useState<ExpenseLinkTargetCandidateView | null>(null);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [expandedScopeIds, setExpandedScopeIds] = useState<Set<string>>(() => new Set(['source:whole']));
  const [allocations, setAllocations] = useState<TransactionLinkAllocationDraft[]>(() =>
    createTransactionLinkAllocationDrafts(transaction.id, snapshot.transactionLinks),
  );
  const [saving, setSaving] = useState(false);
  const [preparedCandidates, setPreparedCandidates] = useState<ExpenseLinkTargetCandidateView[]>([]);
  const preparedInputRef = useRef<{
    snapshot: AppSnapshot;
    draftChanges: TransactionLinkBatchInput;
    scopeId: string;
    statusContext: ReturnType<typeof createTransactionLinkAllocationStatusContext>;
  } | null>(null);
  const discovery = useTransactionLinkCandidateDiscovery(stage === 'find');
  const draftChanges = useMemo(() => getTransactionLinkAllocationDraftStatusChanges({
    sourceTransactionId: transaction.id,
    existingLinks: snapshot.transactionLinks,
    allocations,
  }), [allocations, snapshot.transactionLinks, transaction.id]);
  const statusContext = useMemo(() => createTransactionLinkAllocationStatusContext({
    lines: snapshot.transactionLines,
    persistedLinks: snapshot.transactionLinks,
    draftChanges,
  }), [draftChanges, snapshot.transactionLines, snapshot.transactionLinks]);
  const sourceScopes = useMemo(() => getTransactionLinkSourceScopeViews({
    transaction,
    snapshot,
    draftChanges,
    statusContext,
  }), [draftChanges, snapshot, statusContext, transaction]);
  const selectedSourceScope = sourceScopes.find((scope) => scope.id === selectedSourceScopeId) ?? sourceScopes[0];
  const preparedInputMatches = !!selectedSourceScope &&
    preparedInputRef.current?.snapshot === snapshot &&
    preparedInputRef.current.draftChanges === draftChanges &&
    preparedInputRef.current.scopeId === selectedSourceScope.id &&
    preparedInputRef.current.statusContext === statusContext;
  const candidates = useMemo(() => filterPreparedExpenseLinkTargetCandidateViews(
    preparedInputMatches ? preparedCandidates : [],
    discovery.appliedInput,
  ), [discovery.appliedInput, preparedCandidates, preparedInputMatches]);
  const visibleCandidates = candidates.slice(0, discovery.visibleCount);
  const editingAllocation = allocations.find((allocation) => allocation.id === editingAllocationId);
  useEffect(() => {
    setAllocations(createTransactionLinkAllocationDrafts(transaction.id, snapshot.transactionLinks));
  }, [snapshot.transactionLinks, transaction.id]);

  useEffect(() => {
    if (sourceScopes.length && !sourceScopes.some((scope) => scope.id === selectedSourceScopeId)) {
      setSelectedSourceScopeId(sourceScopes[0].id);
    }
  }, [selectedSourceScopeId, sourceScopes]);

  useEffect(() => {
    if (stage !== 'find' || !discovery.preparationReady || !selectedSourceScope || preparedInputMatches) {
      return;
    }
    const prepared = prepareExpenseLinkTargetCandidateViews({
      snapshot,
      currencyCode: selectedSourceScope.currencyCode,
      currentTransaction: transaction,
      desiredAmountMinor: selectedSourceScope.status.remainingMinor,
      draftChanges,
      statusContext,
    });
    preparedInputRef.current = { snapshot, draftChanges, scopeId: selectedSourceScope.id, statusContext };
    setPreparedCandidates(prepared);
  }, [
    discovery.preparationReady,
    draftChanges,
    preparedInputMatches,
    selectedSourceScope,
    snapshot,
    stage,
    statusContext,
    transaction,
  ]);

  function updateAllocationAmount(allocationId: string, amount: string) {
    setAllocations((current) => current.map((allocation) =>
      allocation.id === allocationId ? { ...allocation, amount } : allocation));
    onError('');
  }

  function removeAllocation(allocationId: string) {
    setAllocations((current) => current.filter((allocation) => allocation.id !== allocationId));
    setEditingAllocationId(null);
    setStage('overview');
  }

  function getAllocationMaximumMinor(allocation: TransactionLinkAllocationDraft): number {
    const sourceStatusInput = {
      transactionId: transaction.id,
      currencyCode: allocation.currencyCode,
      side: 'source' as const,
      lines: snapshot.transactionLines,
      persistedLinks: snapshot.transactionLinks,
      draftChanges,
      context: statusContext,
    };
    const targetStatusInput = {
      transactionId: allocation.targetTransactionId,
      currencyCode: allocation.currencyCode,
      side: 'target' as const,
      lines: snapshot.transactionLines,
      persistedLinks: snapshot.transactionLinks,
      draftChanges,
      context: statusContext,
    };
    const sourceStatus = allocation.sourceLineId
      ? getTransactionLineLinkAllocationStatus({ ...sourceStatusInput, lineId: allocation.sourceLineId })
      : getTransactionLinkAllocationStatus(sourceStatusInput);
    const targetStatus = allocation.targetLineId
      ? getTransactionLineLinkAllocationStatus({ ...targetStatusInput, lineId: allocation.targetLineId })
      : getTransactionLinkAllocationStatus(targetStatusInput);
    return getLinkAllocationEditableMaximumMinor({
      currentAmountMinor: getAllocationAmountMinor(allocation),
      sourceStatus,
      targetStatus,
    });
  }

  function startAddLink() {
    onError('');
    setStage(sourceScopes.length > 1 ? 'current-scope' : 'find');
  }

  function chooseCandidate(candidate: ExpenseLinkTargetCandidateView) {
    if (!candidate.eligible) {
      onError(candidate.disabledReason || 'This expense cannot be linked.');
      return;
    }
    const options = getVisibleTargetOptions({
      candidate,
      snapshot,
      currencyCode: selectedSourceScope.currencyCode,
      draftChanges,
      statusContext,
    }).filter((option) => option.eligible);
    if (options.length === 1) {
      addAllocation(options[0]);
      return;
    }
    setSelectedCandidate(candidate);
    setStage('candidate-scope');
  }

  function addAllocation(option: TransactionLinkTargetOptionView) {
    if (!selectedSourceScope || !option.eligible) {
      onError(option.disabledReason || 'This expense cannot be linked.');
      return;
    }
    const duplicate = allocations.some((allocation) =>
      allocation.sourceLineId === selectedSourceScope.sourceLineId &&
      allocation.targetTransactionId === option.transaction.id &&
      allocation.targetLineId === option.targetLineId);
    if (duplicate) {
      onError('This allocation is already listed.');
      return;
    }
    const amountMinor = getDefaultLinkAllocationAmountMinor(selectedSourceScope.status, option.status);
    if (amountMinor <= 0) {
      onError('No unallocated source amount remains for this selection.');
      return;
    }
    const allocation: TransactionLinkAllocationDraft = {
      id: `draft-${Date.now()}-${option.id}`,
      sourceLineId: selectedSourceScope.sourceLineId,
      targetTransactionId: option.transaction.id,
      targetLineId: option.targetLineId,
      linkType: 'reimbursement',
      amount: formatMinorInput(amountMinor),
      currencyCode: option.currencyCode,
    };
    setAllocations((current) => [...current, allocation]);
    setEditingAllocationId(allocation.id);
    setSelectedCandidate(null);
    setStage('editor');
    onError('');
  }

  async function saveAllocations() {
    setSaving(true);
    try {
      const invalidAllocation = allocations.find((allocation) => {
        const amountMinor = getAllocationAmountMinor(allocation);
        return !isValidTransactionLinkAllocationAmount(allocation) || amountMinor > getAllocationMaximumMinor(allocation);
      });
      if (invalidAllocation) {
        throw new Error('Each allocation must be greater than zero and within the available source and expense capacity.');
      }
      await onSaveTransactionLinkBatch(getTransactionLinkAllocationChanges({
        sourceTransactionId: transaction.id,
        existingLinks: snapshot.transactionLinks,
        allocations,
      }));
      onError('');
      onDone();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'Could not save transaction links.');
    } finally {
      setSaving(false);
    }
  }

  if (!selectedSourceScope) {
    return <Section><Text style={styles.sectionTitle}>This income transaction needs a positive amount before linking.</Text></Section>;
  }

  if (stage === 'current-scope') {
    return (
      <Section>
        <LinkFlowHeader title="Choose where to link" subtitle={transaction.title || 'Income'} onBack={() => setStage('overview')} />
        {sourceScopes.map((scope) => (
          <Pressable
            key={scope.id}
            accessibilityRole="button"
            onPress={() => {
              setSelectedSourceScopeId(scope.id);
              setStage('find');
            }}
            style={({ pressed }) => [styles.scopeChoice, pressed && sharedStyles.pressed]}
          >
            <View style={styles.scopeChoiceText}>
              <Text numberOfLines={2} style={styles.scopeChoiceTitle}>{getScopeTitle(scope.sourceLineId, transaction, snapshot)}</Text>
              <Text style={styles.scopeChoiceStatus}>{formatScopeStatus(scope.status, scope.status.directAllocatedMinor)}</Text>
            </View>
            <Text style={styles.scopeChoiceAmount}>{formatMoney(scope.amountMinor, scope.currencyCode)}</Text>
          </Pressable>
        ))}
      </Section>
    );
  }

  if (stage === 'find') {
    return (
      <Section>
        <LinkFlowHeader title="Find transaction" subtitle={`Link from ${getScopeTitle(selectedSourceScope.sourceLineId, transaction, snapshot)}`} onBack={() => setStage('overview')} />
        <InlineField label="Search" value={discovery.query} onChange={discovery.setQuery} placeholder="Search transactions" />
        <TransactionLinkCandidateFilterControl value={discovery.filter} onChange={discovery.setFilter} />
        {!preparedInputMatches ? <CandidateSkeleton /> : (
          <View style={styles.list}>
            {visibleCandidates.map((candidate) => (
              <LinkCandidateRow
                key={candidate.transaction.id}
                title={candidate.transaction.title || 'Expense'}
                statusText={formatCandidateStatus(candidate.status, false)}
                detail={getCandidateDetail(candidate.accountId, snapshot)}
                amountMinor={candidate.amountMinor}
                currencyCode={candidate.currencyCode}
                dateLabel={formatTransactionShortDate(candidate.transaction.datetime)}
                bestMatch={candidate.exactCapacityMatch}
                disabled={!candidate.eligible}
                onPress={() => chooseCandidate(candidate)}
              />
            ))}
            {!candidates.length ? <Text style={styles.emptyText}>No transactions match this search and filter.</Text> : null}
            {discovery.visibleCount < candidates.length ? (
              <LoadMoreButton onPress={() => discovery.setVisibleCount((count) => count + TRANSACTION_LINK_CANDIDATE_PAGE_SIZE)} />
            ) : null}
          </View>
        )}
      </Section>
    );
  }

  if (stage === 'candidate-scope' && selectedCandidate) {
    return (
      <Section>
        <LinkFlowHeader title="Choose where to apply" subtitle={selectedCandidate.transaction.title || 'Expense'} onBack={() => setStage('find')} />
        <TargetCandidateOptions
          candidate={selectedCandidate}
          snapshot={snapshot}
          currencyCode={selectedSourceScope.currencyCode}
          draftChanges={draftChanges}
          statusContext={statusContext}
          onSelect={addAllocation}
        />
      </Section>
    );
  }

  if (stage === 'editor' && editingAllocation) {
    return (
      <Section>
        <LinkFlowHeader title="Allocation" subtitle={transaction.title || 'Income'} onBack={() => setStage('overview')} />
        <AllocationRow
          allocation={editingAllocation}
          snapshot={snapshot}
          onRemove={editingAllocation.existingLinkId ? () => removeAllocation(editingAllocation.id) : undefined}
          onChangeAmount={(amount) => updateAllocationAmount(editingAllocation.id, amount)}
          onUseMaximum={() => updateAllocationAmount(editingAllocation.id, formatMinorInput(getAllocationMaximumMinor(editingAllocation)))}
        />
        <LinkPrimaryButton label="Done" onPress={() => setStage('overview')} />
      </Section>
    );
  }

  const overviewStatus = sourceScopes[0]?.status ?? selectedSourceScope.status;
  return (
    <>
      <Section>
        <Text style={styles.sectionTitle}>Links overview</Text>
        <Text numberOfLines={2} style={styles.recordTitle}>{transaction.title || 'Income'}</Text>
        <LinkAllocationSummary status={overviewStatus} />
      </Section>
      <Section>
        <Text style={styles.sectionTitle}>Used for{allocations.length ? ` · ${allocations.length}` : ''}</Text>
        <View style={styles.list}>
          {sourceScopes.map((scope) => {
            const scopeAllocations = sortIncomeAllocations(
              allocations.filter((allocation) => allocation.sourceLineId === scope.sourceLineId),
              snapshot,
            );
            const expanded = expandedScopeIds.has(scope.id);
            const allocatedMinor = scopeAllocations.reduce((sum, allocation) => sum + getAllocationAmountMinor(allocation), 0);
            return (
              <LinkOverviewGroup
                key={scope.id}
                title={getScopeTitle(scope.sourceLineId, transaction, snapshot)}
                amountMinor={scope.amountMinor}
                currencyCode={scope.currencyCode}
                statusText={formatScopeStatus(scope.status, allocatedMinor)}
                relationshipCount={scopeAllocations.length}
                expanded={expanded}
                onToggle={() => setExpandedScopeIds((current) => toggleSetValue(current, scope.id))}
                testID={`link-scope-${scope.id}`}
              >
                {scopeAllocations.length ? scopeAllocations.map((allocation) => {
                  const display = getTransactionLinkEndpointDisplay({
                    transactionId: allocation.targetTransactionId,
                    lineId: allocation.targetLineId,
                    transactions: snapshot.transactions,
                    lines: snapshot.transactionLines,
                    categories: snapshot.categories,
                  });
                  const targetTransaction = snapshot.transactions.find((item) => item.id === allocation.targetTransactionId);
                  return (
                    <LinkOverviewAllocationRow
                      key={allocation.id}
                      title={display.title || targetTransaction?.title || 'Linked expense'}
                      amountMinor={getAllocationAmountMinor(allocation)}
                      currencyCode={allocation.currencyCode}
                      dateLabel={display.dateLabel}
                      directionLabel={`Used for ${targetTransaction?.title || 'expense'}`}
                      testID={`link-relationship-${allocation.id}`}
                      onPress={() => {
                        setEditingAllocationId(allocation.id);
                        setStage('editor');
                      }}
                    />
                  );
                }) : <Text style={styles.emptyText}>Unlinked</Text>}
              </LinkOverviewGroup>
            );
          })}
        </View>
        <LinkPrimaryButton label="Add link" onPress={startAddLink} />
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={saveAllocations}
          style={({ pressed }) => [styles.saveButton, (pressed || saving) && sharedStyles.pressed]}
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save links'}</Text>
        </Pressable>
      </Section>
    </>
  );
}

function Section({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

function CandidateSkeleton() {
  return (
    <View accessibilityLabel="Preparing transaction results" accessibilityRole="progressbar" style={styles.list}>
      {[0, 1, 2].map((index) => <View key={index} style={styles.skeletonRow} />)}
    </View>
  );
}

function LoadMoreButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.loadMoreButton, pressed && sharedStyles.pressed]}>
      <Text style={styles.loadMoreText}>Load more</Text>
    </Pressable>
  );
}

function getVisibleTargetOptions({
  candidate,
  snapshot,
  currencyCode,
  draftChanges,
  statusContext,
}: {
  candidate: ExpenseLinkTargetCandidateView;
  snapshot: AppSnapshot;
  currencyCode: string;
  draftChanges: TransactionLinkBatchInput;
  statusContext: ReturnType<typeof createTransactionLinkAllocationStatusContext>;
}) {
  const options = getTransactionLinkTargetOptionViews({
    transaction: candidate.transaction,
    currencyCode,
    snapshot,
    draftChanges,
    statusContext,
  });
  if (candidate.searchMatchesParent || !candidate.searchMatchedLineIds.length) {
    return options;
  }
  const matchedLineIds = new Set(candidate.searchMatchedLineIds);
  return options.filter((option) => !option.targetLineId || matchedLineIds.has(option.targetLineId));
}

function getScopeTitle(lineId: string | null, transaction: Transaction, snapshot: AppSnapshot): string {
  if (!lineId) return 'Whole transaction';
  return getTransactionLinkEndpointDisplay({
    transactionId: transaction.id,
    lineId,
    transactions: snapshot.transactions,
    lines: snapshot.transactionLines,
    categories: snapshot.categories,
  }).title || 'Split line';
}

function formatScopeStatus(status: ScopedTransactionLinkAllocationStatus, directAllocatedMinor: number): string {
  if (directAllocatedMinor <= 0) return 'Unlinked';
  const remainingMinor = status.scope === 'transaction' ? status.parentRemainingMinor : status.remainingMinor;
  if (remainingMinor <= 0) return 'Settled';
  return `Linked ${formatMoney(directAllocatedMinor, status.currencyCode)} · ${formatMoney(remainingMinor, status.currencyCode)} left`;
}

function formatCandidateStatus(status: ScopedTransactionLinkAllocationStatus, source: boolean): string {
  const originalLabel = source ? 'Received' : 'Original';
  const allocatedLabel = source ? 'Used' : 'Allocated';
  const remainingLabel = source ? 'Available' : 'Remaining';
  return `${originalLabel} ${formatMoney(status.originalMinor, status.currencyCode)} · ${allocatedLabel} ${formatMoney(status.allocatedMinor, status.currencyCode)} · ${remainingLabel} ${formatMoney(status.remainingMinor, status.currencyCode)}`;
}

function getCandidateDetail(accountId: string, snapshot: AppSnapshot): string {
  const account = snapshot.accounts.find((item) => item.id === accountId);
  return account ? getAccountDisplayName(account) : '';
}

function sortIncomeAllocations(allocations: TransactionLinkAllocationDraft[], snapshot: AppSnapshot) {
  return [...allocations].sort((left, right) => {
    const leftDate = snapshot.transactions.find((item) => item.id === left.targetTransactionId)?.datetime ?? '';
    const rightDate = snapshot.transactions.find((item) => item.id === right.targetTransactionId)?.datetime ?? '';
    return rightDate.localeCompare(leftDate) || left.id.localeCompare(right.id);
  });
}

function toggleSetValue(current: Set<string>, value: string): Set<string> {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

const styles = StyleSheet.create({
  section: { backgroundColor: colors.surface, borderColor: colors.faint, borderRadius: 8, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  recordTitle: { color: colors.ink, fontSize: typography.h3, fontWeight: '900' },
  list: { gap: spacing.sm },
  emptyText: { color: colors.muted, fontSize: typography.small, fontWeight: '700', padding: spacing.sm },
  scopeChoice: { alignItems: 'center', borderColor: colors.faint, borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 58, padding: spacing.sm },
  scopeChoiceText: { flex: 1, gap: 2, minWidth: 0 },
  scopeChoiceTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  scopeChoiceStatus: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '800' },
  scopeChoiceAmount: { color: colors.ink, flexShrink: 0, fontSize: typography.small, fontWeight: '900' },
  skeletonRow: { backgroundColor: colors.surfaceMuted, borderRadius: 8, height: 72 },
  loadMoreButton: { alignItems: 'center', borderColor: colors.primary, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 40 },
  loadMoreText: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '900' },
  saveButton: { alignItems: 'center', borderColor: colors.primary, borderRadius: 8, borderWidth: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: spacing.md },
  saveButtonText: { color: colors.primaryDark, fontSize: typography.body, fontWeight: '900' },
});
