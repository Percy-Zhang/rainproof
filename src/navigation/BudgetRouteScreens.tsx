import { useEffect } from 'react';

import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { BudgetFormScreen } from '../features/budgets/BudgetFormScreen';
import { BudgetPeriodSelectScreen } from '../features/budgets/BudgetPeriodSelectScreen';
import { useBudgetPeriodSelectionRequests } from '../features/budgets/BudgetPeriodSelectionContext';
import { BudgetScopeSelectScreen } from '../features/budgets/BudgetScopeSelectScreen';
import { useBudgetScopeSelectionRequests } from '../features/budgets/BudgetScopeSelectionContext';
import {
  ComposerRouteScaffold,
  PREPARING_RAINPROOF_MESSAGE,
  RouteMessageShell,
} from './RouteScaffold';
import { findRouteItemById } from './routeLookup';
import { useRootStackNavigation, useRootStackRoute } from './routeHooks';
import {
  useOpenBudgetPeriodSelect,
  useOpenBudgetScopeSelect,
} from './rootStackSelectionHooks';

export function AddBudgetRouteScreen() {
  const navigation = useRootStackNavigation();
  const { snapshot, actions } = useRainproofDataContext();
  const openBudgetScopeSelect = useOpenBudgetScopeSelect(navigation);
  const openBudgetPeriodSelect = useOpenBudgetPeriodSelect(navigation);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  return (
    <ComposerRouteScaffold screenKey="addBudget">
      <BudgetFormScreen
        mode="add"
        snapshot={snapshot}
        onAddBudget={actions.addBudget}
        onOpenBudgetPeriodSelect={openBudgetPeriodSelect}
        onOpenBudgetScopeSelect={openBudgetScopeSelect}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function EditBudgetRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'EditBudget'>();
  const { snapshot, actions } = useRainproofDataContext();
  const budget = findRouteItemById(snapshot?.budgets, route.params.budgetId);
  const openBudgetScopeSelect = useOpenBudgetScopeSelect(navigation);
  const openBudgetPeriodSelect = useOpenBudgetPeriodSelect(navigation);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  if (!budget) {
    return <RouteMessageShell message="Budget not found." />;
  }

  return (
    <ComposerRouteScaffold screenKey="editBudget">
      <BudgetFormScreen
        mode="edit"
        snapshot={snapshot}
        budget={budget}
        onUpdateBudget={actions.updateBudget}
        onArchiveBudget={actions.archiveBudget}
        onOpenBudgetPeriodSelect={openBudgetPeriodSelect}
        onOpenBudgetScopeSelect={openBudgetScopeSelect}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function BudgetPeriodSelectRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'BudgetPeriodSelect'>();
  const {
    hasBudgetPeriodSelectionRequest,
    resolveBudgetPeriodSelectionRequest,
    unregisterBudgetPeriodSelectionRequest,
  } = useBudgetPeriodSelectionRequests();
  const requestId = route.params.requestId;
  const requestExists = hasBudgetPeriodSelectionRequest(requestId);

  useEffect(() => {
    if (!requestExists) {
      navigation.goBack();
    }

    return () => unregisterBudgetPeriodSelectionRequest(requestId);
  }, [navigation, requestExists, requestId, unregisterBudgetPeriodSelectionRequest]);

  if (!requestExists) {
    return <RouteMessageShell message="Budget period selection expired." />;
  }

  return (
    <ComposerRouteScaffold screenKey="budgetPeriodSelect">
      <BudgetPeriodSelectScreen
        selectedPeriod={route.params.selectedPeriod}
        onBack={() => navigation.goBack()}
        onSelect={(period) => {
          if (resolveBudgetPeriodSelectionRequest(requestId, period)) {
            navigation.goBack();
          }
        }}
      />
    </ComposerRouteScaffold>
  );
}

export function BudgetScopeSelectRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'BudgetScopeSelect'>();
  const { snapshot } = useRainproofDataContext();
  const {
    hasBudgetScopeSelectionRequest,
    resolveBudgetScopeSelectionRequest,
    unregisterBudgetScopeSelectionRequest,
  } = useBudgetScopeSelectionRequests();
  const requestId = route.params.requestId;
  const requestExists = hasBudgetScopeSelectionRequest(requestId);

  useEffect(() => {
    if (!requestExists) {
      navigation.goBack();
    }

    return () => unregisterBudgetScopeSelectionRequest(requestId);
  }, [navigation, requestExists, requestId, unregisterBudgetScopeSelectionRequest]);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  if (!requestExists) {
    return <RouteMessageShell message="Budget category selection expired." />;
  }

  return (
    <ComposerRouteScaffold screenKey="budgetScopeSelect">
      <BudgetScopeSelectScreen
        categories={snapshot.categories}
        mode={route.params.mode}
        selectedItems={route.params.selectedItems}
        onBack={() => navigation.goBack()}
        onConfirm={(scopeItems) => {
          if (resolveBudgetScopeSelectionRequest(requestId, scopeItems)) {
            navigation.goBack();
          }
        }}
      />
    </ComposerRouteScaffold>
  );
}
