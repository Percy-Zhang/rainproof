import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

import type { CategorySelectionResult } from './categorySelectionModel';

type CategorySelectionRequest = {
  onSelect: (selection: CategorySelectionResult) => void;
};

type CategorySelectionRequestContextValue = {
  hasCategorySelectionRequest: (requestId: string) => boolean;
  registerCategorySelectionRequest: (
    requestId: string,
    onSelect: (selection: CategorySelectionResult) => void,
  ) => void;
  resolveCategorySelectionRequest: (requestId: string, selection: CategorySelectionResult) => boolean;
  unregisterCategorySelectionRequest: (requestId: string) => void;
};

const CategorySelectionRequestContext = createContext<CategorySelectionRequestContextValue | null>(null);

let categorySelectionRequestCounter = 0;

export function createCategorySelectionRequestId(): string {
  categorySelectionRequestCounter += 1;
  return `category-select-${Date.now()}-${categorySelectionRequestCounter}`;
}

export function CategorySelectionRequestProvider({ children }: { children: ReactNode }) {
  const requests = useRef(new Map<string, CategorySelectionRequest>());

  const hasCategorySelectionRequest = useCallback((requestId: string) => (
    requests.current.has(requestId)
  ), []);

  const registerCategorySelectionRequest = useCallback((
    requestId: string,
    onSelect: (selection: CategorySelectionResult) => void,
  ) => {
    requests.current.set(requestId, { onSelect });
  }, []);

  const resolveCategorySelectionRequest = useCallback((requestId: string, selection: CategorySelectionResult) => {
    const request = requests.current.get(requestId);
    if (!request) {
      return false;
    }

    requests.current.delete(requestId);
    request.onSelect(selection);
    return true;
  }, []);

  const unregisterCategorySelectionRequest = useCallback((requestId: string) => {
    requests.current.delete(requestId);
  }, []);

  const value = useMemo(
    () => ({
      hasCategorySelectionRequest,
      registerCategorySelectionRequest,
      resolveCategorySelectionRequest,
      unregisterCategorySelectionRequest,
    }),
    [
      hasCategorySelectionRequest,
      registerCategorySelectionRequest,
      resolveCategorySelectionRequest,
      unregisterCategorySelectionRequest,
    ],
  );

  return (
    <CategorySelectionRequestContext.Provider value={value}>
      {children}
    </CategorySelectionRequestContext.Provider>
  );
}

export function useCategorySelectionRequests(): CategorySelectionRequestContextValue {
  const value = useContext(CategorySelectionRequestContext);
  if (!value) {
    throw new Error('Category selection requests are not available.');
  }

  return value;
}
