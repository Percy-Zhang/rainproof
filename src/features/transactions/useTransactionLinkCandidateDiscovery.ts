import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_TRANSACTION_LINK_CANDIDATE_FILTER,
  TRANSACTION_LINK_CANDIDATE_PAGE_SIZE,
  type TransactionLinkCandidateFilter,
} from '../../domain/transactionLinkCandidateModel';

export function useTransactionLinkCandidateDiscovery(active: boolean) {
  const [query, setQuery] = useState('');
  const [resultState, setResultState] = useState({
    filter: DEFAULT_TRANSACTION_LINK_CANDIDATE_FILTER as TransactionLinkCandidateFilter,
    visibleCount: TRANSACTION_LINK_CANDIDATE_PAGE_SIZE,
  });
  const [preparationReady, setPreparationReady] = useState(false);
  const endReachedHandledRef = useRef(false);
  const scrollIntentRef = useRef(false);
  const appliedQuery = useDeferredValue(query);

  const resetPagination = useCallback(() => {
    scrollIntentRef.current = false;
    endReachedHandledRef.current = false;
    setResultState((current) => current.visibleCount === TRANSACTION_LINK_CANDIDATE_PAGE_SIZE
      ? current
      : { ...current, visibleCount: TRANSACTION_LINK_CANDIDATE_PAGE_SIZE });
  }, []);

  const updateQuery = useCallback((nextQuery: string) => {
    resetPagination();
    setQuery(nextQuery);
  }, [resetPagination]);

  const updateFilter = useCallback((nextFilter: TransactionLinkCandidateFilter) => {
    scrollIntentRef.current = false;
    endReachedHandledRef.current = false;
    setResultState((current) => (
      current.filter === nextFilter && current.visibleCount === TRANSACTION_LINK_CANDIDATE_PAGE_SIZE
        ? current
        : { filter: nextFilter, visibleCount: TRANSACTION_LINK_CANDIDATE_PAGE_SIZE }
    ));
  }, []);

  const revealNextPage = useCallback((totalCount: number) => {
    if (!scrollIntentRef.current || endReachedHandledRef.current) {
      return;
    }
    setResultState((current) => {
      if (!scrollIntentRef.current || endReachedHandledRef.current || current.visibleCount >= totalCount) {
        scrollIntentRef.current = false;
        endReachedHandledRef.current = true;
        return current;
      }
      scrollIntentRef.current = false;
      endReachedHandledRef.current = true;
      return {
        ...current,
        visibleCount: Math.min(current.visibleCount + TRANSACTION_LINK_CANDIDATE_PAGE_SIZE, totalCount),
      };
    });
  }, []);

  const beginPaginationScroll = useCallback(() => {
    scrollIntentRef.current = true;
    endReachedHandledRef.current = false;
  }, []);

  useEffect(() => {
    if (!active || preparationReady) {
      return;
    }

    let cancelled = false;
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        if (!cancelled) {
          setPreparationReady(true);
        }
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      if (secondFrame) {
        cancelAnimationFrame(secondFrame);
      }
    };
  }, [active, preparationReady]);

  useEffect(() => {
    resetPagination();
  }, [appliedQuery, resetPagination]);

  return {
    appliedQuery,
    beginPaginationScroll,
    filter: resultState.filter,
    preparationReady,
    query,
    resetPagination,
    revealNextPage,
    setFilter: updateFilter,
    setQuery: updateQuery,
    visibleCount: resultState.visibleCount,
  };
}
