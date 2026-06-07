import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

import type { BudgetScopeItem } from '../../domain/types';

type BudgetScopeSelectionRequest = {
  onConfirm: (scopeItems: BudgetScopeItem[]) => void;
};

type BudgetScopeSelectionRequestContextValue = {
  hasBudgetScopeSelectionRequest: (requestId: string) => boolean;
  registerBudgetScopeSelectionRequest: (
    requestId: string,
    onConfirm: (scopeItems: BudgetScopeItem[]) => void,
  ) => void;
  resolveBudgetScopeSelectionRequest: (requestId: string, scopeItems: BudgetScopeItem[]) => boolean;
  unregisterBudgetScopeSelectionRequest: (requestId: string) => void;
};

const BudgetScopeSelectionRequestContext =
  createContext<BudgetScopeSelectionRequestContextValue | null>(null);

let budgetScopeSelectionRequestCounter = 0;

export function createBudgetScopeSelectionRequestId(): string {
  budgetScopeSelectionRequestCounter += 1;
  return `budget-scope-select-${Date.now()}-${budgetScopeSelectionRequestCounter}`;
}

export function BudgetScopeSelectionRequestProvider({ children }: { children: ReactNode }) {
  const requests = useRef(new Map<string, BudgetScopeSelectionRequest>());

  const hasBudgetScopeSelectionRequest = useCallback(
    (requestId: string) => requests.current.has(requestId),
    [],
  );

  const registerBudgetScopeSelectionRequest = useCallback((
    requestId: string,
    onConfirm: (scopeItems: BudgetScopeItem[]) => void,
  ) => {
    requests.current.set(requestId, { onConfirm });
  }, []);

  const resolveBudgetScopeSelectionRequest = useCallback(
    (requestId: string, scopeItems: BudgetScopeItem[]) => {
      const request = requests.current.get(requestId);
      if (!request) {
        return false;
      }

      requests.current.delete(requestId);
      request.onConfirm(scopeItems);
      return true;
    },
    [],
  );

  const unregisterBudgetScopeSelectionRequest = useCallback((requestId: string) => {
    requests.current.delete(requestId);
  }, []);

  const value = useMemo(
    () => ({
      hasBudgetScopeSelectionRequest,
      registerBudgetScopeSelectionRequest,
      resolveBudgetScopeSelectionRequest,
      unregisterBudgetScopeSelectionRequest,
    }),
    [
      hasBudgetScopeSelectionRequest,
      registerBudgetScopeSelectionRequest,
      resolveBudgetScopeSelectionRequest,
      unregisterBudgetScopeSelectionRequest,
    ],
  );

  return (
    <BudgetScopeSelectionRequestContext.Provider value={value}>
      {children}
    </BudgetScopeSelectionRequestContext.Provider>
  );
}

export function useBudgetScopeSelectionRequests(): BudgetScopeSelectionRequestContextValue {
  const value = useContext(BudgetScopeSelectionRequestContext);
  if (!value) {
    throw new Error('Budget scope selection requests are not available.');
  }

  return value;
}
