import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getAccountDisplayName } from '../../domain/accountThemes';
import { formatMoney } from '../../domain/money';
import {
  createExpenseTransactionLinkAllocationDrafts,
  formatMinorInput,
  getAllocationAmountMinor,
  getExpenseTransactionLinkAllocationDraftStatusChanges,
  getExpenseTransactionLinkAllocationChanges,
  isValidTransactionLinkAllocationAmount,
  type ExpenseTransactionLinkAllocationDraft,
} from '../../domain/transactionLinkAllocationForm';
import {
  TRANSACTION_LINK_CANDIDATE_PAGE_SIZE,
  filterPreparedIncomeLinkSourceCandidateViews,
  getDefaultLinkAllocationAmountMinor,
  getLinkAllocationEditableMaximumMinor,
  getTransactionLinkSourceOptionViews,
  getTransactionLinkTargetScopeViews,
  prepareIncomeLinkSourceCandidateViews,
  type IncomeLinkSourceCandidateView,
  type TransactionLinkSourceOptionView,
} from '../../domain/transactionLinkCandidateModel';
import {
  createTransactionLinkAllocationStatusContext,
  getTransactionLineLinkAllocationStatus,
  getTransactionLinkAllocationStatus,
  type ScopedTransactionLinkAllocationStatus,
  type TransactionLinkAllocationStatusContext,
} from '../../domain/transactionLinkAllocationStatus';
import { formatTransactionShortDate } from '../../domain/transactionDisplay';
import { getTransactionLinkEndpointDisplay } from '../../domain/transactionLinking';
import type { AppSnapshot, Transaction, TransactionLinkBatchInput } from '../../domain/types';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import { ExpenseAllocationRow, SourceCandidateOptions } from './IncomeLinkManagerRows';
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

type ExpenseLinkManagerProps = {
  snapshot: AppSnapshot;
  transaction: Transaction;
  onSaveTransactionLinkBatch: (input: TransactionLinkBatchInput) => Promise<void>;
  onDone: () => void;
  onError: (message: string) => void;
};

type LinkFlowStage = 'overview' | 'current-scope' | 'find' | 'candidate-scope' | 'editor';

export function ExpenseLinkManager({
  snapshot,
  transaction,
  onSaveTransactionLinkBatch,
  onDone,
  onError,
}: ExpenseLinkManagerProps) {
  const [stage, setStage] = useState<LinkFlowStage>('overview');
  const [selectedTargetScopeId, setSelectedTargetScopeId] = useState('target:whole');
  const [selectedCandidate, setSelectedCandidate] = useState<IncomeLinkSourceCandidateView | null>(null);
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [expandedScopeIds, setExpandedScopeIds] = useState<Set<string>>(() => new Set(['target:whole']));
  const [allocations, setAllocations] = useState<ExpenseTransactionLinkAllocationDraft[]>(() =>
    createExpenseTransactionLinkAllocationDrafts(transaction.id, snapshot.transactionLinks),
  );
  const [saving, setSaving] = useState(false);
  const [preparedCandidates, setPreparedCandidates] = useState<IncomeLinkSourceCandidateView[]>([]);
  const preparedInputRef = useRef<{
    snapshot: AppSnapshot;
    draftChanges: TransactionLinkBatchInput;
    scopeId: string;
    statusContext: TransactionLinkAllocationStatusContext;
  } | null>(null);
  const discovery = useTransactionLinkCandidateDiscovery(stage === 'find');
  const draftChanges = useMemo(() => getExpenseTransactionLinkAllocationDraftStatusChanges({
    targetTransactionId: transaction.id,
    existingLinks: snapshot.transactionLinks,
    allocations,
  }), [allocations, snapshot.transactionLinks, transaction.id]);
  const statusContext = useMemo(() => createTransactionLinkAllocationStatusContext({
    lines: snapshot.transactionLines,
    persistedLinks: snapshot.transactionLinks,
    draftChanges,
  }), [draftChanges, snapshot.transactionLines, snapshot.transactionLinks]);
  const targetScopes = useMemo(() => getTransactionLinkTargetScopeViews({
    transaction,
    snapshot,
    draftChanges,
    statusContext,
  }), [draftChanges, snapshot, statusContext, transaction]);
  const selectedTargetScope = targetScopes.find((scope) => scope.id === selectedTargetScopeId) ?? targetScopes[0];
  const preparedInputMatches = !!selectedTargetScope &&
    preparedInputRef.current?.snapshot === snapshot &&
    preparedInputRef.current.draftChanges === draftChanges &&
    preparedInputRef.current.scopeId === selectedTargetScope.id &&
    preparedInputRef.current.statusContext === statusContext;
  const candidates = useMemo(() => filterPreparedIncomeLinkSourceCandidateViews(
    preparedInputMatches ? preparedCandidates : [],
    discovery.appliedInput,
  ), [discovery.appliedInput, preparedCandidates, preparedInputMatches]);
  const visibleCandidates = candidates.slice(0, discovery.visibleCount);
  const editingAllocation = allocations.find((allocation) => allocation.id === editingAllocationId);

  useEffect(() => {
    setAllocations(createExpenseTransactionLinkAllocationDrafts(transaction.id, snapshot.transactionLinks));
  }, [snapshot.transactionLinks, transaction.id]);

  useEffect(() => {
    if (targetScopes.length && !targetScopes.some((scope) => scope.id === selectedTargetScopeId)) {
      setSelectedTargetScopeId(targetScopes[0].id);
    }
  }, [selectedTargetScopeId, targetScopes]);

  useEffect(() => {
    if (stage !== 'find' || !discovery.preparationReady || !selectedTargetScope || preparedInputMatches) {
      return;
    }
    const prepared = prepareIncomeLinkSourceCandidateViews({
      snapshot,
      currencyCode: selectedTargetScope.currencyCode,
      currentTransaction: transaction,
      desiredAmountMinor: selectedTargetScope.status.remainingMinor,
      draftChanges,
      statusContext,
    });
    preparedInputRef.current = { snapshot, draftChanges, scopeId: selectedTargetScope.id, statusContext };
    setPreparedCandidates(prepared);
  }, [
    discovery.preparationReady,
    draftChanges,
    preparedInputMatches,
    selectedTargetScope,
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

  function getAllocationMaximumMinor(allocation: ExpenseTransactionLinkAllocationDraft): number {
    const sourceStatusInput = {
      transactionId: allocation.sourceTransactionId,
      currencyCode: allocation.currencyCode,
      side: 'source' as const,
      lines: snapshot.transactionLines,
      persistedLinks: snapshot.transactionLinks,
      draftChanges,
      context: statusContext,
    };
    const targetStatusInput = {
      transactionId: transaction.id,
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
    setStage(targetScopes.length > 1 ? 'current-scope' : 'find');
  }

  function chooseCandidate(candidate: IncomeLinkSourceCandidateView) {
    if (!candidate.eligible) {
      onError(candidate.disabledReason || 'This income cannot be linked.');
      return;
    }
    const options = getVisibleSourceOptions({
      candidate,
      snapshot,
      currencyCode: selectedTargetScope.currencyCode,
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

  function addAllocation(option: TransactionLinkSourceOptionView) {
    if (!selectedTargetScope || !option.eligible) {
      onError(option.disabledReason || 'This income cannot be linked.');
      return;
    }
    const duplicate = allocations.some((allocation) =>
      allocation.sourceTransactionId === option.transaction.id &&
      allocation.sourceLineId === option.sourceLineId &&
      allocation.targetLineId === selectedTargetScope.targetLineId);
    if (duplicate) {
      onError('This allocation is already listed.');
      return;
    }
    const amountMinor = getDefaultLinkAllocationAmountMinor(option.status, selectedTargetScope.status);
    if (amountMinor <= 0) {
      onError('No unallocated expense amount remains for this selection.');
      return;
    }
    const allocation: ExpenseTransactionLinkAllocationDraft = {
      id: `draft-${Date.now()}-${option.id}`,
      sourceTransactionId: option.transaction.id,
      sourceLineId: option.sourceLineId,
      targetLineId: selectedTargetScope.targetLineId,
      linkType: 'refund',
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
        throw new Error('Each allocation must be greater than zero and within the available income and expense capacity.');
      }
      await onSaveTransactionLinkBatch(getExpenseTransactionLinkAllocationChanges({
        targetTransactionId: transaction.id,
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

  if (!selectedTargetScope) {
    return <Section><Text style={styles.sectionTitle}>This expense transaction needs a negative amount before linking.</Text></Section>;
  }

  if (stage === 'current-scope') {
    return (
      <Section>
        <LinkFlowHeader title="Choose where to apply" subtitle={transaction.title || 'Expense'} onBack={() => setStage('overview')} />
        {targetScopes.map((scope) => (
          <Pressable
            key={scope.id}
            accessibilityRole="button"
            onPress={() => {
              setSelectedTargetScopeId(scope.id);
              setStage('find');
            }}
            style={({ pressed }) => [styles.scopeChoice, pressed && sharedStyles.pressed]}
          >
            <View style={styles.scopeChoiceText}>
              <Text numberOfLines={2} style={styles.scopeChoiceTitle}>{getScopeTitle(scope.targetLineId, transaction, snapshot)}</Text>
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
        <LinkFlowHeader title="Find transaction" subtitle={`Payment for ${getScopeTitle(selectedTargetScope.targetLineId, transaction, snapshot)}`} onBack={() => setStage('overview')} />
        <InlineField label="Search" value={discovery.query} onChange={discovery.setQuery} placeholder="Search transactions" />
        <TransactionLinkCandidateFilterControl value={discovery.filter} onChange={discovery.setFilter} />
        {!preparedInputMatches ? <CandidateSkeleton /> : (
          <View style={styles.list}>
            {visibleCandidates.map((candidate) => (
              <LinkCandidateRow
                key={candidate.transaction.id}
                title={candidate.transaction.title || 'Income'}
                statusText={formatCandidateStatus(candidate.status)}
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
        <LinkFlowHeader title="Choose payment source" subtitle={selectedCandidate.transaction.title || 'Income'} onBack={() => setStage('find')} />
        <SourceCandidateOptions
          candidate={selectedCandidate}
          snapshot={snapshot}
          currencyCode={selectedTargetScope.currencyCode}
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
        <LinkFlowHeader title="Allocation" subtitle={transaction.title || 'Expense'} onBack={() => setStage('overview')} />
        <ExpenseAllocationRow
          allocation={editingAllocation}
          snapshot={snapshot}
          targetTransaction={transaction}
          onRemove={editingAllocation.existingLinkId ? () => removeAllocation(editingAllocation.id) : undefined}
          onChangeAmount={(amount) => updateAllocationAmount(editingAllocation.id, amount)}
          onUseMaximum={() => updateAllocationAmount(editingAllocation.id, formatMinorInput(getAllocationMaximumMinor(editingAllocation)))}
        />
        <LinkPrimaryButton label="Done" onPress={() => setStage('overview')} />
      </Section>
    );
  }

  const overviewStatus = targetScopes[0]?.status ?? selectedTargetScope.status;
  return (
    <>
      <Section>
        <Text style={styles.sectionTitle}>Links overview</Text>
        <Text numberOfLines={2} style={styles.recordTitle}>{transaction.title || 'Expense'}</Text>
        <LinkAllocationSummary status={overviewStatus} />
      </Section>
      <Section>
        <Text style={styles.sectionTitle}>Payments received{allocations.length ? ` · ${allocations.length}` : ''}</Text>
        <View style={styles.list}>
          {targetScopes.map((scope) => {
            const scopeAllocations = sortExpenseAllocations(
              allocations.filter((allocation) => allocation.targetLineId === scope.targetLineId),
              snapshot,
            );
            const expanded = expandedScopeIds.has(scope.id);
            const allocatedMinor = scopeAllocations.reduce((sum, allocation) => sum + getAllocationAmountMinor(allocation), 0);
            return (
              <LinkOverviewGroup
                key={scope.id}
                title={getScopeTitle(scope.targetLineId, transaction, snapshot)}
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
                    transactionId: allocation.sourceTransactionId,
                    lineId: allocation.sourceLineId,
                    transactions: snapshot.transactions,
                    lines: snapshot.transactionLines,
                    categories: snapshot.categories,
                  });
                  const sourceTransaction = snapshot.transactions.find((item) => item.id === allocation.sourceTransactionId);
                  return (
                    <LinkOverviewAllocationRow
                      key={allocation.id}
                      title={display.title || sourceTransaction?.title || 'Linked payment'}
                      amountMinor={getAllocationAmountMinor(allocation)}
                      currencyCode={allocation.currencyCode}
                      dateLabel={display.dateLabel}
                      directionLabel={`Payment from ${sourceTransaction?.title || 'income'}`}
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
        <LinkPrimaryButton label="Add payment" onPress={startAddLink} />
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

function getVisibleSourceOptions({
  candidate,
  snapshot,
  currencyCode,
  draftChanges,
  statusContext,
}: {
  candidate: IncomeLinkSourceCandidateView;
  snapshot: AppSnapshot;
  currencyCode: string;
  draftChanges: TransactionLinkBatchInput;
  statusContext: TransactionLinkAllocationStatusContext;
}) {
  const options = getTransactionLinkSourceOptionViews({
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
  return options.filter((option) => !option.sourceLineId || matchedLineIds.has(option.sourceLineId));
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

function formatCandidateStatus(status: ScopedTransactionLinkAllocationStatus): string {
  return `Received ${formatMoney(status.originalMinor, status.currencyCode)} · Used ${formatMoney(status.allocatedMinor, status.currencyCode)} · Available ${formatMoney(status.remainingMinor, status.currencyCode)}`;
}

function getCandidateDetail(accountId: string, snapshot: AppSnapshot): string {
  const account = snapshot.accounts.find((item) => item.id === accountId);
  return account ? getAccountDisplayName(account) : '';
}

function sortExpenseAllocations(allocations: ExpenseTransactionLinkAllocationDraft[], snapshot: AppSnapshot) {
  return [...allocations].sort((left, right) => {
    const leftDate = snapshot.transactions.find((item) => item.id === left.sourceTransactionId)?.datetime ?? '';
    const rightDate = snapshot.transactions.find((item) => item.id === right.sourceTransactionId)?.datetime ?? '';
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
