import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_TRANSACTION_LINK_CANDIDATE_FILTER,
  TRANSACTION_LINK_CANDIDATE_PAGE_SIZE,
  type TransactionLinkCandidateFilter,
} from '../../domain/transactionLinkCandidateModel';

export function useTransactionLinkCandidateDiscovery(active: boolean) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TransactionLinkCandidateFilter>(DEFAULT_TRANSACTION_LINK_CANDIDATE_FILTER);
  const [preparationReady, setPreparationReady] = useState(false);
  const [visibleCount, setVisibleCount] = useState(TRANSACTION_LINK_CANDIDATE_PAGE_SIZE);
  const requestedInput = useMemo(() => ({ filter, query }), [filter, query]);
  const appliedInput = useDeferredValue(requestedInput);

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
    setVisibleCount(TRANSACTION_LINK_CANDIDATE_PAGE_SIZE);
  }, [appliedInput]);

  return {
    appliedInput,
    filter,
    preparationReady,
    query,
    setFilter,
    setQuery,
    setVisibleCount,
    visibleCount,
  };
}
