import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

import type { BudgetPeriod } from '../../domain/types';

type BudgetPeriodSelectionRequest = {
  onSelect: (period: BudgetPeriod) => void;
};

type BudgetPeriodSelectionRequestContextValue = {
  hasBudgetPeriodSelectionRequest: (requestId: string) => boolean;
  registerBudgetPeriodSelectionRequest: (
    requestId: string,
    onSelect: (period: BudgetPeriod) => void,
  ) => void;
  resolveBudgetPeriodSelectionRequest: (requestId: string, period: BudgetPeriod) => boolean;
  unregisterBudgetPeriodSelectionRequest: (requestId: string) => void;
};

const BudgetPeriodSelectionRequestContext =
  createContext<BudgetPeriodSelectionRequestContextValue | null>(null);

let budgetPeriodSelectionRequestCounter = 0;

export function createBudgetPeriodSelectionRequestId(): string {
  budgetPeriodSelectionRequestCounter += 1;
  return `budget-period-select-${Date.now()}-${budgetPeriodSelectionRequestCounter}`;
}

export function BudgetPeriodSelectionRequestProvider({ children }: { children: ReactNode }) {
  const requests = useRef(new Map<string, BudgetPeriodSelectionRequest>());

  const hasBudgetPeriodSelectionRequest = useCallback(
    (requestId: string) => requests.current.has(requestId),
    [],
  );

  const registerBudgetPeriodSelectionRequest = useCallback((
    requestId: string,
    onSelect: (period: BudgetPeriod) => void,
  ) => {
    requests.current.set(requestId, { onSelect });
  }, []);

  const resolveBudgetPeriodSelectionRequest = useCallback((requestId: string, period: BudgetPeriod) => {
    const request = requests.current.get(requestId);
    if (!request) {
      return false;
    }

    requests.current.delete(requestId);
    request.onSelect(period);
    return true;
  }, []);

  const unregisterBudgetPeriodSelectionRequest = useCallback((requestId: string) => {
    requests.current.delete(requestId);
  }, []);

  const value = useMemo(
    () => ({
      hasBudgetPeriodSelectionRequest,
      registerBudgetPeriodSelectionRequest,
      resolveBudgetPeriodSelectionRequest,
      unregisterBudgetPeriodSelectionRequest,
    }),
    [
      hasBudgetPeriodSelectionRequest,
      registerBudgetPeriodSelectionRequest,
      resolveBudgetPeriodSelectionRequest,
      unregisterBudgetPeriodSelectionRequest,
    ],
  );

  return (
    <BudgetPeriodSelectionRequestContext.Provider value={value}>
      {children}
    </BudgetPeriodSelectionRequestContext.Provider>
  );
}

export function useBudgetPeriodSelectionRequests(): BudgetPeriodSelectionRequestContextValue {
  const value = useContext(BudgetPeriodSelectionRequestContext);
  if (!value) {
    throw new Error('Budget period selection requests are not available.');
  }

  return value;
}
