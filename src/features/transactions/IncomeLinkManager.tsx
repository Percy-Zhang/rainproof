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
  createTransactionLinkAllocationDrafts,
  formatMinorInput,
  getAllocationAmountMinor,
  getTransactionLinkAllocationDraftStatusChanges,
  getTransactionLinkAllocationChanges,
  type TransactionLinkAllocationDraft,
} from '../../domain/transactionLinkAllocationForm';
import {
  getDefaultLinkAllocationAmountMinor,
  getTransactionLinkCandidateStatusBuckets,
  getTransactionLinkSourceScopeViews,
  getTransactionLinkTargetOptionViews,
  prepareExpenseLinkTargetCandidateViews,
  searchPreparedExpenseLinkTargetCandidateViews,
  type ExpenseLinkTargetCandidateView,
  type TransactionLinkTargetOptionView,
} from '../../domain/transactionLinkCandidateModel';
import {
  createTransactionLinkAllocationStatusContext,
  getTransactionLineLinkAllocationStatus,
  getTransactionLinkAllocationStatus,
  type ScopedTransactionLinkAllocationStatus,
} from '../../domain/transactionLinkAllocationStatus';
import {
  getTransactionLinkEndpointDisplay,
  getTransactionLinkEndpointSignedAmountMinor,
} from '../../domain/transactionLinking';
import { formatTransactionShortDate } from '../../domain/transactionDisplay';
import type { AppSnapshot, Transaction, TransactionLinkBatchInput } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { TargetCandidateOptions } from './IncomeLinkManagerRows';
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

type IncomeLinkManagerProps = {
  initialDraftChanges?: TransactionLinkBatchInput;
  snapshot: AppSnapshot;
  transaction: Transaction;
  onError: (message: string) => void;
  onStageTitleChange?: (title: string) => void;
};

type LinkFlowStage = 'overview' | 'find' | 'editor';

const EMPTY_LINK_BATCH: TransactionLinkBatchInput = { toAdd: [], toUpdate: [], deleteIds: [] };
const getCandidateKey = (candidate: ExpenseLinkTargetCandidateView) => candidate.transaction.id;

export const IncomeLinkManager = forwardRef<TransactionLinkManagerHandle, IncomeLinkManagerProps>(function IncomeLinkManager({
  initialDraftChanges = EMPTY_LINK_BATCH,
  snapshot,
  transaction,
  onError,
  onStageTitleChange,
}: IncomeLinkManagerProps, ref) {
  const [stage, setStage] = useState<LinkFlowStage>('overview');
  const [selectedSourceScopeId, setSelectedSourceScopeId] = useState('source:whole');
  const [expandedCandidateId, setExpandedCandidateId] = useState<string | null>(null);
  const [editorAllocation, setEditorAllocation] = useState<TransactionLinkAllocationDraft | null>(null);
  const [editorReturnStage, setEditorReturnStage] = useState<'find' | 'overview'>('overview');
  const [expandedScopeIds, setExpandedScopeIds] = useState<Set<string>>(() => new Set(['source:whole']));
  const [allocations, setAllocations] = useState<TransactionLinkAllocationDraft[]>(() =>
    createTransactionLinkAllocationDrafts(transaction.id, snapshot.transactionLinks, initialDraftChanges),
  );
  const [preparedCandidates, setPreparedCandidates] = useState<ExpenseLinkTargetCandidateView[]>([]);
  const preparedInputRef = useRef<{
    snapshot: AppSnapshot;
    draftChanges: TransactionLinkBatchInput;
    scopeId: string;
    statusContext: ReturnType<typeof createTransactionLinkAllocationStatusContext>;
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
  const draftChanges = useMemo(() => getTransactionLinkAllocationDraftStatusChanges({
    sourceTransactionId: transaction.id,
    existingLinks: snapshot.transactionLinks,
    allocations,
  }), [allocations, snapshot.transactionLinks, transaction.id]);
  const acceptedChanges = useMemo(() => getTransactionLinkAllocationChanges({
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
  const searchedCandidates = useMemo(() => searchPreparedExpenseLinkTargetCandidateViews(
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
    if (sourceScopes.length && !sourceScopes.some((scope) => scope.id === selectedSourceScopeId)) {
      setSelectedSourceScopeId(sourceScopes[0].id);
    }
  }, [selectedSourceScopeId, sourceScopes]);

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
    if (stage !== 'find' || !preparationReady || !selectedSourceScope || preparedInputMatches) {
      return;
    }
    const prepared = prepareExpenseLinkTargetCandidateViews({
      snapshot,
      currencyCode: selectedSourceScope.currencyCode,
      currentTransaction: transaction,
      draftChanges,
      statusContext,
    });
    resetPagination();
    preparedInputRef.current = { snapshot, draftChanges, scopeId: selectedSourceScope.id, statusContext };
    setPreparedCandidates(prepared);
  }, [
    draftChanges,
    preparationReady,
    preparedInputMatches,
    resetPagination,
    selectedSourceScope,
    snapshot,
    stage,
    statusContext,
    transaction,
  ]);

  const startNewAllocation = useCallback((option: TransactionLinkTargetOptionView) => {
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
    setEditorAllocation({
      id: `draft-${Date.now()}-${option.id}`,
      sourceLineId: selectedSourceScope.sourceLineId,
      targetTransactionId: option.transaction.id,
      targetLineId: option.targetLineId,
      linkType: 'reimbursement',
      amount: formatMinorInput(amountMinor),
      currencyCode: option.currencyCode,
    });
    setEditorReturnStage('find');
    setStage('editor');
    onError('');
  }, [allocations, onError, selectedSourceScope]);

  const chooseCandidate = useCallback((candidate: ExpenseLinkTargetCandidateView) => {
    if (!selectedSourceScope || !candidate.selectable) {
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
    if (!options.length) {
      onError('No unallocated expense amount remains for this selection.');
      return;
    }
    startNewAllocation(options[0]);
  }, [draftChanges, onError, selectedSourceScope, snapshot, startNewAllocation, statusContext]);

  const toggleCandidate = useCallback((candidateId: string) => {
    setExpandedCandidateId((current) => current === candidateId ? null : candidateId);
  }, []);

  const renderCandidate = useCallback<ListRenderItem<ExpenseLinkTargetCandidateView>>(({ item: candidate }) => {
    const expanded = expandedCandidateId === candidate.transaction.id;
    return (
      <TransactionLinkCandidateGroup
        candidate={candidate}
        expanded={expanded}
        onPress={chooseCandidate}
        onToggle={toggleCandidate}
      >
        {expanded ? (
          <TargetCandidateOptions
            candidate={candidate}
            snapshot={snapshot}
            currencyCode={selectedSourceScope?.currencyCode ?? candidate.currencyCode}
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
    selectedSourceScope?.currencyCode,
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
    setSelectedSourceScopeId(scopeId);
    setExpandedCandidateId(null);
    setStage('find');
    onError('');
  }

  function editAllocation(allocation: TransactionLinkAllocationDraft) {
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
    allocation: TransactionLinkAllocationDraft,
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

  function getAutomaticAllocationAmountMinor(allocation: TransactionLinkAllocationDraft): number {
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
    return getDefaultLinkAllocationAmountMinor(sourceStatus, targetStatus);
  }

  function acceptEditorAllocation() {
    if (!editorAllocation) return;
    const amountMinor = getAutomaticAllocationAmountMinor(editorAllocation);
    if (amountMinor <= 0) {
      onError('No unallocated source or expense capacity remains for this link.');
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

  if (!selectedSourceScope) {
    return <View style={styles.stage}><Text style={styles.sectionTitle}>This income transaction needs a positive amount before linking.</Text></View>;
  }

  if (stage === 'find') {
    return (
      <View style={styles.findStage}>
        <View style={styles.findHeader} testID="link-find-fixed-header">
          {!onStageTitleChange ? <Text style={styles.sectionTitle}>Find transaction</Text> : null}
          <LinkEndpointSummaryCard
          lineId={selectedSourceScope.sourceLineId}
          currencyCode={selectedSourceScope.currencyCode}
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
    const targetDisplay = getTransactionLinkEndpointDisplay({
      transactionId: editorAllocation.targetTransactionId,
      lineId: editorAllocation.targetLineId,
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
          sourceTransactionId={transaction.id}
          snapshot={snapshot}
          targetLineId={editorAllocation.targetLineId}
          targetTransactionId={editorAllocation.targetTransactionId}
          onAction={existing
            ? () => confirmUnlinkAllocation(
                editorAllocation,
                targetDisplay.title || 'this transaction',
                true,
              )
            : acceptEditorAllocation}
        />
      </ScrollView>
    );
  }

  const overviewStatus = sourceScopes[0]?.status ?? selectedSourceScope.status;
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
          title={transaction.title || 'Income'}
          transactionId={transaction.id}
        />
        <LinkAllocationSummary status={overviewStatus} />
      </View>
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
              signedAmountMinor={scope.amountMinor}
              currencyCode={scope.currencyCode}
              statusText={formatScopeStatus(scope.status, allocatedMinor)}
              relationshipCount={scopeAllocations.length}
              expanded={expanded}
              lineId={scope.sourceLineId}
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
                    signedAmountMinor={getTransactionLinkEndpointSignedAmountMinor({
                      transactionId: allocation.targetTransactionId,
                      lineId: allocation.targetLineId,
                      currencyCode: allocation.currencyCode,
                      lines: snapshot.transactionLines,
                    })}
                    currencyCode={allocation.currencyCode}
                    dateLabel={display.dateLabel}
                    directionLabel={`Used for ${targetTransaction?.title || 'expense'}`}
                    iconTransactionId={allocation.targetTransactionId}
                    iconLineId={allocation.targetLineId}
                    snapshot={snapshot}
                    testID={`link-relationship-${allocation.id}`}
                    onPress={() => editAllocation(allocation)}
                    onUnlink={() => confirmUnlinkAllocation(
                      allocation,
                      display.title || targetTransaction?.title || 'this transaction',
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
  if (candidate.searchMatchesParent || !candidate.searchMatchedLineIds.length) return options;
  const matchedLineIds = new Set(candidate.searchMatchedLineIds);
  return options.filter((option) => !!option.targetLineId && matchedLineIds.has(option.targetLineId));
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
