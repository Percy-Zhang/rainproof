import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View, type ListRenderItem } from 'react-native';

import { formatMoney } from '../../domain/money';
import {
  createExpenseTransactionLinkAllocationDrafts,
  formatMinorInput,
  getAllocationAmountMinor,
  getExpenseTransactionLinkAllocationDraftStatusChanges,
  getExpenseTransactionLinkAllocationChanges,
  type ExpenseTransactionLinkAllocationDraft,
} from '../../domain/transactionLinkAllocationForm';
import {
  getDefaultLinkAllocationAmountMinor,
  getTransactionLinkCandidateStatusBuckets,
  getTransactionLinkSourceOptionViews,
  getTransactionLinkTargetScopeViews,
  prepareIncomeLinkSourceCandidateViews,
  searchPreparedIncomeLinkSourceCandidateViews,
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
import {
  getTransactionLinkEndpointDisplay,
  getTransactionLinkEndpointSignedAmountMinor,
} from '../../domain/transactionLinking';
import { formatTransactionShortDate } from '../../domain/transactionDisplay';
import type { AppSnapshot, Transaction, TransactionLinkBatchInput } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { SourceCandidateOptions } from './IncomeLinkManagerRows';
import {
  LinkAllocationSummary,
  TransactionLinkCandidateFilterControl,
  TransactionLinkSearchField,
} from './TransactionLinkControls';
import { TransactionLinkCandidateGroup } from './TransactionLinkCandidateGroup';
import {
  LinkEndpointSummaryCard,
  LinkOverviewAllocationRow,
  LinkOverviewGroup,
  LinkRelationshipDetail,
  LinkScopeParentSummary,
  type TransactionLinkManagerHandle,
} from './TransactionLinkFlowViews';
import { useTransactionLinkCandidateDiscovery } from './useTransactionLinkCandidateDiscovery';

type ExpenseLinkManagerProps = {
  initialDraftChanges?: TransactionLinkBatchInput;
  snapshot: AppSnapshot;
  transaction: Transaction;
  onError: (message: string) => void;
  onStageTitleChange?: (title: string) => void;
};

type LinkFlowStage = 'overview' | 'find' | 'editor';

const EMPTY_LINK_BATCH: TransactionLinkBatchInput = { toAdd: [], toUpdate: [], deleteIds: [] };
const getCandidateKey = (candidate: IncomeLinkSourceCandidateView) => candidate.transaction.id;

export const ExpenseLinkManager = forwardRef<TransactionLinkManagerHandle, ExpenseLinkManagerProps>(function ExpenseLinkManager({
  initialDraftChanges = EMPTY_LINK_BATCH,
  snapshot,
  transaction,
  onError,
  onStageTitleChange,
}: ExpenseLinkManagerProps, ref) {
  const [stage, setStage] = useState<LinkFlowStage>('overview');
  const [selectedTargetScopeId, setSelectedTargetScopeId] = useState('target:whole');
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);
  const [editorAllocation, setEditorAllocation] = useState<ExpenseTransactionLinkAllocationDraft | null>(null);
  const [editorReturnStage, setEditorReturnStage] = useState<'find' | 'overview'>('overview');
  const [expandedScopeIds, setExpandedScopeIds] = useState<Set<string>>(() => new Set(['target:whole']));
  const [allocations, setAllocations] = useState<ExpenseTransactionLinkAllocationDraft[]>(() =>
    createExpenseTransactionLinkAllocationDrafts(transaction.id, snapshot.transactionLinks, initialDraftChanges),
  );
  const [preparedCandidates, setPreparedCandidates] = useState<IncomeLinkSourceCandidateView[]>([]);
  const preparedInputRef = useRef<{
    snapshot: AppSnapshot;
    draftChanges: TransactionLinkBatchInput;
    scopeId: string;
    statusContext: TransactionLinkAllocationStatusContext;
  } | null>(null);
  const {
    appliedQuery,
    beginPaginationScroll,
    filter: candidateFilter,
    preparationReady,
    query: candidateQuery,
    resetPagination,
    revealNextPage,
    setFilter: setCandidateFilter,
    setQuery: setCandidateQuery,
    visibleCount,
  } = useTransactionLinkCandidateDiscovery(stage === 'find');
  const draftChanges = useMemo(() => getExpenseTransactionLinkAllocationDraftStatusChanges({
    targetTransactionId: transaction.id,
    existingLinks: snapshot.transactionLinks,
    allocations,
  }), [allocations, snapshot.transactionLinks, transaction.id]);
  const acceptedChanges = useMemo(() => getExpenseTransactionLinkAllocationChanges({
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
  const searchedCandidates = useMemo(() => searchPreparedIncomeLinkSourceCandidateViews(
    preparedInputMatches ? preparedCandidates : [],
    appliedQuery,
  ), [appliedQuery, preparedCandidates, preparedInputMatches]);
  const candidatesByStatus = useMemo(
    () => getTransactionLinkCandidateStatusBuckets(searchedCandidates),
    [searchedCandidates],
  );
  const filteredCandidates = candidatesByStatus[candidateFilter];
  const visibleCandidates = useMemo(
    () => filteredCandidates.slice(0, visibleCount),
    [filteredCandidates, visibleCount],
  );

  useEffect(() => {
    onStageTitleChange?.(getStageTitle(stage, editorReturnStage));
  }, [editorReturnStage, onStageTitleChange, stage]);

  useEffect(() => {
    if (targetScopes.length && !targetScopes.some((scope) => scope.id === selectedTargetScopeId)) {
      setSelectedTargetScopeId(targetScopes[0].id);
    }
  }, [selectedTargetScopeId, targetScopes]);

  useEffect(() => {
    if (
      expandedCandidateId &&
      preparedInputMatches &&
      !filteredCandidates.some((candidate) => candidate.transaction.id === expandedCandidateId)
    ) {
      setExpandedCandidateId(null);
    }
  }, [expandedCandidateId, filteredCandidates, preparedInputMatches]);

  useEffect(() => {
    if (stage !== 'find' || !preparationReady || !selectedTargetScope || preparedInputMatches) {
      return;
    }
    const prepared = prepareIncomeLinkSourceCandidateViews({
      snapshot,
      currencyCode: selectedTargetScope.currencyCode,
      currentTransaction: transaction,
      draftChanges,
      statusContext,
    });
    resetPagination();
    preparedInputRef.current = { snapshot, draftChanges, scopeId: selectedTargetScope.id, statusContext };
    setPreparedCandidates(prepared);
  }, [
    draftChanges,
    preparationReady,
    preparedInputMatches,
    resetPagination,
    selectedTargetScope,
    snapshot,
    stage,
    statusContext,
    transaction,
  ]);

  const startNewAllocation = useCallback((option: TransactionLinkSourceOptionView) => {
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
    setEditorAllocation({
      id: `draft-${Date.now()}-${option.id}`,
      sourceTransactionId: option.transaction.id,
      sourceLineId: option.sourceLineId,
      targetLineId: selectedTargetScope.targetLineId,
      linkType: 'refund',
      amount: formatMinorInput(amountMinor),
      currencyCode: option.currencyCode,
    });
    setEditorReturnStage('find');
    setStage('editor');
    onError('');
  }, [allocations, onError, selectedTargetScope]);

  const chooseCandidate = useCallback((candidate: IncomeLinkSourceCandidateView) => {
    if (!selectedTargetScope || !candidate.selectable) {
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
    if (!options.length) {
      onError('No unallocated income amount remains for this selection.');
      return;
    }
    startNewAllocation(options[0]);
  }, [draftChanges, onError, selectedTargetScope, snapshot, startNewAllocation, statusContext]);

  const toggleCandidate = useCallback((candidateId: string) => {
    setExpandedCandidateId((current) => current === candidateId ? null : candidateId);
  }, []);

  const renderCandidate = useCallback<ListRenderItem<IncomeLinkSourceCandidateView>>(({ item: candidate }) => {
    const expanded = expandedCandidateId === candidate.transaction.id;
    return (
      <TransactionLinkCandidateGroup
        candidate={candidate}
        expanded={expanded}
        onPress={chooseCandidate}
        onToggle={toggleCandidate}
      >
        {expanded ? (
          <SourceCandidateOptions
            candidate={candidate}
            snapshot={snapshot}
            currencyCode={selectedTargetScope?.currencyCode ?? candidate.currencyCode}
            draftChanges={draftChanges}
            statusContext={statusContext}
            onSelect={startNewAllocation}
          />
        ) : null}
      </TransactionLinkCandidateGroup>
    );
  }, [
    chooseCandidate,
    draftChanges,
    expandedCandidateId,
    selectedTargetScope?.currencyCode,
    snapshot,
    startNewAllocation,
    statusContext,
    toggleCandidate,
  ]);

  const handleEndReached = useCallback(() => {
    revealNextPage(filteredCandidates.length);
  }, [filteredCandidates.length, revealNextPage]);

  const resolveBack = useCallback(() => {
    if (stage === 'editor') {
      setEditorAllocation(null);
      setStage(editorReturnStage);
      onError('');
      return true;
    }
    if (expandedCandidateId) {
      setExpandedCandidateId(null);
      return true;
    }
    if (stage === 'find') {
      setStage('overview');
      onError('');
      return true;
    }
    return false;
  }, [editorReturnStage, expandedCandidateId, onError, stage]);

  useImperativeHandle(ref, () => ({
    getDraftChanges: () => acceptedChanges,
    handleBack: resolveBack,
  }), [acceptedChanges, resolveBack]);

  function openFindForScope(scopeId: string) {
    setSelectedTargetScopeId(scopeId);
    setExpandedCandidateId(null);
    setStage('find');
    onError('');
  }

  function editAllocation(allocation: ExpenseTransactionLinkAllocationDraft) {
    setEditorAllocation({ ...allocation });
    setEditorReturnStage('overview');
    setStage('editor');
    onError('');
  }

  function unlinkAllocation(allocationId: string) {
    setAllocations((current) => current.filter((allocation) => allocation.id !== allocationId));
    onError('');
  }

  function confirmUnlinkAllocation(
    allocation: ExpenseTransactionLinkAllocationDraft,
    relationshipTitle: string,
    returnToOverview = false,
  ) {
    Alert.alert(
      'Unlink transaction?',
      `Remove the link with ${relationshipTitle}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: () => {
            unlinkAllocation(allocation.id);
            if (returnToOverview) {
              setEditorAllocation(null);
              setStage('overview');
            }
          },
        },
      ],
    );
  }

  function getAutomaticAllocationAmountMinor(allocation: ExpenseTransactionLinkAllocationDraft): number {
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
    return getDefaultLinkAllocationAmountMinor(sourceStatus, targetStatus);
  }

  function acceptEditorAllocation() {
    if (!editorAllocation) return;
    const amountMinor = getAutomaticAllocationAmountMinor(editorAllocation);
    if (amountMinor <= 0) {
      onError('No unallocated income or expense capacity remains for this link.');
      return;
    }
    const acceptedAllocation = { ...editorAllocation, amount: formatMinorInput(amountMinor) };
    setAllocations((current) => {
      const existingIndex = current.findIndex((allocation) => allocation.id === acceptedAllocation.id);
      if (existingIndex < 0) return [...current, acceptedAllocation];
      return current.map((allocation) => allocation.id === acceptedAllocation.id ? acceptedAllocation : allocation);
    });
    setEditorAllocation(null);
    setStage('overview');
    onError('');
  }

  if (!selectedTargetScope) {
    return <View style={styles.stage}><Text style={styles.sectionTitle}>This expense transaction needs a negative amount before linking.</Text></View>;
  }

  if (stage === 'find') {
    return (
      <View style={styles.findStage}>
        <View style={styles.findHeader} testID="link-find-fixed-header">
          {!onStageTitleChange ? <Text style={styles.sectionTitle}>Find transaction</Text> : null}
          <LinkEndpointSummaryCard
            lineId={selectedTargetScope.targetLineId}
          currencyCode={selectedTargetScope.currencyCode}
            snapshot={snapshot}
            transactionId={transaction.id}
            testID="link-find-source-summary"
          />
          <TransactionLinkSearchField value={candidateQuery} onChange={setCandidateQuery} />
          <TransactionLinkCandidateFilterControl value={candidateFilter} onChange={setCandidateFilter} />
        </View>
        <FlatList
          contentContainerStyle={styles.resultsContent}
          data={preparedInputMatches ? visibleCandidates : []}
          extraData={expandedCandidateId}
          initialNumToRender={8}
          keyboardShouldPersistTaps="handled"
          keyExtractor={getCandidateKey}
          ListEmptyComponent={!preparedInputMatches
            ? <CandidateSkeleton />
            : <Text style={styles.emptyText}>No transactions match this search and filter.</Text>}
          maxToRenderPerBatch={8}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          onScrollBeginDrag={beginPaginationScroll}
          renderItem={renderCandidate}
          showsVerticalScrollIndicator={false}
          style={styles.resultsScroll}
          testID="link-find-results-scroll"
        />
      </View>
    );
  }

  if (stage === 'editor' && editorAllocation) {
    const existing = editorReturnStage === 'overview';
    const amountMinor = existing
      ? getAllocationAmountMinor(editorAllocation)
      : getAutomaticAllocationAmountMinor(editorAllocation);
    const sourceDisplay = getTransactionLinkEndpointDisplay({
      transactionId: editorAllocation.sourceTransactionId,
      lineId: editorAllocation.sourceLineId,
      transactions: snapshot.transactions,
      lines: snapshot.transactionLines,
      categories: snapshot.categories,
    });
    return (
      <ScrollView
        contentContainerStyle={styles.stageScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.stageScroll}
      >
        {!onStageTitleChange ? <Text style={styles.sectionTitle}>{existing ? 'Linked transaction' : 'Link transaction'}</Text> : null}
        <LinkRelationshipDetail
          amountMinor={amountMinor}
          currencyCode={editorAllocation.currencyCode}
          existing={existing}
          sourceLineId={editorAllocation.sourceLineId}
          sourceTransactionId={editorAllocation.sourceTransactionId}
          snapshot={snapshot}
          targetLineId={editorAllocation.targetLineId}
          targetTransactionId={transaction.id}
          onAction={existing
            ? () => confirmUnlinkAllocation(
                editorAllocation,
                sourceDisplay.title || 'this transaction',
                true,
              )
            : acceptEditorAllocation}
        />
      </ScrollView>
    );
  }

  const overviewStatus = targetScopes[0]?.status ?? selectedTargetScope.status;
  return (
    <ScrollView
      contentContainerStyle={styles.stageScrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.stageScroll}
    >
      {!onStageTitleChange ? <Text style={styles.sectionTitle}>Links</Text> : null}
      <View style={styles.summarySection}>
        <LinkScopeParentSummary
          dateLabel={formatTransactionShortDate(transaction.datetime)}
          snapshot={snapshot}
          status={overviewStatus}
          title={transaction.title || 'Expense'}
          transactionId={transaction.id}
        />
        <LinkAllocationSummary status={overviewStatus} />
      </View>
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
              signedAmountMinor={-scope.amountMinor}
              currencyCode={scope.currencyCode}
              statusText={formatScopeStatus(scope.status, allocatedMinor)}
              relationshipCount={scopeAllocations.length}
              expanded={expanded}
              lineId={scope.targetLineId}
              linked={allocatedMinor > 0}
              snapshot={snapshot}
              transactionId={transaction.id}
              onLink={scope.selectable && getScopeRemainingMinor(scope.status) > 0
                ? () => openFindForScope(scope.id)
                : undefined}
              onToggle={() => setExpandedScopeIds((current) => toggleSetValue(current, scope.id))}
              testID={`link-scope-${scope.id}`}
            >
              {scopeAllocations.map((allocation) => {
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
                    signedAmountMinor={getTransactionLinkEndpointSignedAmountMinor({
                      transactionId: allocation.sourceTransactionId,
                      lineId: allocation.sourceLineId,
                      currencyCode: allocation.currencyCode,
                      lines: snapshot.transactionLines,
                    })}
                    currencyCode={allocation.currencyCode}
                    dateLabel={display.dateLabel}
                    directionLabel={`Payment from ${sourceTransaction?.title || 'income'}`}
                    iconTransactionId={allocation.sourceTransactionId}
                    iconLineId={allocation.sourceLineId}
                    snapshot={snapshot}
                    testID={`link-relationship-${allocation.id}`}
                    onPress={() => editAllocation(allocation)}
                    onUnlink={() => confirmUnlinkAllocation(
                      allocation,
                      display.title || sourceTransaction?.title || 'this transaction',
                    )}
                  />
                );
              })}
            </LinkOverviewGroup>
          );
        })}
      </View>
    </ScrollView>
  );
});

function CandidateSkeleton() {
  return (
    <View accessibilityLabel="Preparing transaction results" accessibilityRole="progressbar" style={styles.list}>
      {[0, 1, 2].map((index) => <View key={index} style={styles.skeletonRow} />)}
    </View>
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
  if (candidate.searchMatchesParent || !candidate.searchMatchedLineIds.length) return options;
  const matchedLineIds = new Set(candidate.searchMatchedLineIds);
  return options.filter((option) => !!option.sourceLineId && matchedLineIds.has(option.sourceLineId));
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

function getScopeRemainingMinor(status: ScopedTransactionLinkAllocationStatus): number {
  return status.scope === 'transaction' ? status.parentRemainingMinor : status.remainingMinor;
}

function formatScopeStatus(status: ScopedTransactionLinkAllocationStatus, directAllocatedMinor: number): string {
  if (directAllocatedMinor <= 0) return 'Open';
  const remainingMinor = getScopeRemainingMinor(status);
  if (remainingMinor <= 0) return 'Settled';
  return `Linked ${formatMoney(directAllocatedMinor, status.currencyCode)} · Remaining ${formatMoney(remainingMinor, status.currencyCode)}`;
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

function getStageTitle(stage: LinkFlowStage, editorReturnStage: 'find' | 'overview'): string {
  if (stage === 'find') return 'Find transaction';
  if (stage === 'editor') return editorReturnStage === 'overview' ? 'Linked transaction' : 'Link transaction';
  return 'Links';
}

const styles = StyleSheet.create({
  stage: { gap: spacing.sm },
  stageScroll: { flex: 1 },
  stageScrollContent: { gap: spacing.sm, paddingBottom: 140 },
  findStage: { flex: 1, gap: spacing.sm },
  findHeader: { gap: spacing.sm },
  resultsScroll: { flex: 1 },
  resultsContent: { gap: spacing.sm, paddingBottom: 140 },
  summarySection: { backgroundColor: colors.surface, borderColor: colors.faint, borderRadius: 8, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  list: { gap: spacing.sm },
  emptyText: { color: colors.muted, fontSize: typography.small, fontWeight: '700', padding: spacing.sm },
  skeletonRow: { backgroundColor: colors.surfaceMuted, borderRadius: 8, height: 72 },
});
