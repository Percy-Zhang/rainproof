import { useCallback } from 'react';

import {
  createBudgetPeriodSelectionRequestId,
  useBudgetPeriodSelectionRequests,
} from '../features/budgets/BudgetPeriodSelectionContext';
import type {
  BudgetPeriodSelectLaunchParams,
} from '../features/budgets/budgetPeriodSelectionModel';
import {
  createBudgetScopeSelectionRequestId,
  useBudgetScopeSelectionRequests,
} from '../features/budgets/BudgetScopeSelectionContext';
import type {
  BudgetScopeSelectLaunchParams,
} from '../features/budgets/budgetScopeSelectionModel';
import {
  createCategorySelectionRequestId,
  useCategorySelectionRequests,
} from '../features/categorySelection/CategorySelectionContext';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../features/categorySelection/categorySelectionModel';
import type { BudgetPeriod, BudgetScopeItem } from '../domain/types';
import type { RootStackNavigation } from './routeHooks';

export type OpenCategorySelect = (
  params: CategorySelectLaunchParams,
  onSelect: (selection: CategorySelectionResult) => void,
) => void;

export type OpenBudgetScopeSelect = (
  params: BudgetScopeSelectLaunchParams,
  onConfirm: (scopeItems: BudgetScopeItem[]) => void,
) => void;

export type OpenBudgetPeriodSelect = (
  params: BudgetPeriodSelectLaunchParams,
  onSelect: (period: BudgetPeriod) => void,
) => void;

export function useOpenCategorySelect(navigation: RootStackNavigation): OpenCategorySelect {
  const { registerCategorySelectionRequest } = useCategorySelectionRequests();

  return useCallback((params, onSelect) => {
    const requestId = createCategorySelectionRequestId();
    registerCategorySelectionRequest(requestId, onSelect);
    navigation.navigate('CategorySelect', { ...params, requestId });
  }, [navigation, registerCategorySelectionRequest]);
}

export function useOpenBudgetScopeSelect(navigation: RootStackNavigation): OpenBudgetScopeSelect {
  const { registerBudgetScopeSelectionRequest } = useBudgetScopeSelectionRequests();

  return useCallback((params, onConfirm) => {
    const requestId = createBudgetScopeSelectionRequestId();
    registerBudgetScopeSelectionRequest(requestId, onConfirm);
    navigation.navigate('BudgetScopeSelect', { ...params, requestId });
  }, [navigation, registerBudgetScopeSelectionRequest]);
}

export function useOpenBudgetPeriodSelect(navigation: RootStackNavigation): OpenBudgetPeriodSelect {
  const { registerBudgetPeriodSelectionRequest } = useBudgetPeriodSelectionRequests();

  return useCallback((params, onSelect) => {
    const requestId = createBudgetPeriodSelectionRequestId();
    registerBudgetPeriodSelectionRequest(requestId, onSelect);
    navigation.navigate('BudgetPeriodSelect', { ...params, requestId });
  }, [navigation, registerBudgetPeriodSelectionRequest]);
}
