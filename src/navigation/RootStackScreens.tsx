import { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { getDashboardRecurringSummary } from '../domain/dashboardRecurring';
import { AccountFormScreen } from '../features/accounts/AccountFormScreen';
import { BudgetFormScreen } from '../features/budgets/BudgetFormScreen';
import { buildAddTransactionPrefillFromTemplate } from '../domain/transactionTemplates';
import {
  createCategorySelectionRequestId,
  useCategorySelectionRequests,
} from '../features/categorySelection/CategorySelectionContext';
import { CategorySelectScreen } from '../features/categorySelection/CategorySelectScreen';
import type {
  CategorySelectLaunchParams,
  CategorySelectionResult,
} from '../features/categorySelection/categorySelectionModel';
import { RainyDayFundScreen } from '../features/rainyDay/RainyDayFundScreen';
import { RecurringItemFormScreen } from '../features/recurring/RecurringItemFormScreen';
import { RecurringTransactionReviewScreen } from '../features/recurring/RecurringTransactionReviewScreen';
import {
  DashboardAddCardsScreen,
  DashboardEditScreen,
} from '../features/dashboard/DashboardCardCustomizationScreens';
import { StatsDrilldownScreen } from '../features/stats/StatsDrilldownScreen';
import { TransactionTemplateFormScreen } from '../features/templates/TransactionTemplateFormScreen';
import { AddTransactionScreen } from '../features/transactions/AddTransactionScreen';
import { EditTransactionScreen } from '../features/transactions/EditTransactionScreen';
import { LinkTransactionScreen } from '../features/transactions/LinkTransactionScreen';
import { spacing } from '../theme/tokens';
import type { AccountBalance, Budget, RecurringItem } from '../domain/types';
import {
  ComposerRouteScaffold,
  PREPARING_RAINPROOF_MESSAGE,
  RouteMessageShell,
  RouteSafeArea,
  RouteTopBar,
} from './RouteScaffold';
import { findRouteItemById } from './routeLookup';
import { type RootStackNavigation, useRootStackNavigation, useRootStackRoute } from './routeHooks';

type OpenCategorySelect = (
  params: CategorySelectLaunchParams,
  onSelect: (selection: CategorySelectionResult) => void,
) => void;

function useOpenCategorySelect(navigation: RootStackNavigation): OpenCategorySelect {
  const { registerCategorySelectionRequest } = useCategorySelectionRequests();

  return useCallback((params, onSelect) => {
    const requestId = createCategorySelectionRequestId();
    registerCategorySelectionRequest(requestId, onSelect);
    navigation.navigate('CategorySelect', { ...params, requestId });
  }, [navigation, registerCategorySelectionRequest]);
}

export function AddAccountRouteScreen() {
  const navigation = useRootStackNavigation();
  const { snapshot, actions } = useRainproofDataContext();

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  return (
    <ComposerRouteScaffold screenKey="addAccount">
      <AccountFormScreen
        mode="add"
        snapshot={snapshot}
        onAddAccount={actions.addAccount}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function EditAccountRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'EditAccount'>();
  const { snapshot, actions } = useRainproofDataContext();
  const account = findRouteItemById(snapshot?.accounts, route.params.accountId);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  if (!account) {
    return <RouteMessageShell message="Account not found." />;
  }

  return (
    <ComposerRouteScaffold screenKey="editAccount">
      <AccountFormScreen
        mode="edit"
        snapshot={snapshot}
        account={account}
        onUpdateAccount={actions.updateAccount}
        onCloseAccount={actions.closeAccount}
        onReopenAccount={actions.reopenAccount}
        onDeleteAccount={actions.deleteAccount}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function AddTransactionRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'AddTransaction'>();
  const { snapshot, actions } = useRainproofDataContext();
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  const templateId = route.params?.templateId;
  const template = templateId ? findRouteItemById(snapshot.transactionTemplates, templateId) : undefined;
  if (templateId && !template) {
    return <RouteMessageShell message="Transaction template not found." />;
  }

  let initialTemplate;
  try {
    initialTemplate = template
      ? buildAddTransactionPrefillFromTemplate({
          accounts: snapshot.accounts,
          template,
        })
      : undefined;
  } catch (caught) {
    return <RouteMessageShell message={caught instanceof Error ? caught.message : 'Transaction template needs attention.'} />;
  }

  return (
    <ComposerRouteScaffold screenKey="addTransaction">
      <AddTransactionScreen
        dashboardAccountIds={route.params?.dashboardAccountIds}
        initialTemplate={initialTemplate}
        snapshot={snapshot}
        onAddTransaction={actions.addTransaction}
        onUpdateAddTransactionDefaults={(addTransactionDefaults) =>
          actions.updateAddTransactionDefaults({ addTransactionDefaults })}
        onOpenCategorySelect={openCategorySelect}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function EditTransactionRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'EditTransaction'>();
  const { snapshot, actions } = useRainproofDataContext();
  const { transactionId } = route.params;
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  return (
    <ComposerRouteScaffold screenKey="editTransaction">
      <EditTransactionScreen
        snapshot={snapshot}
        transactionId={transactionId}
        onUpdateTransaction={actions.updateTransaction}
        onDeleteTransaction={actions.deleteTransaction}
        onUpdateTransactionLink={actions.updateTransactionLink}
        onDeleteTransactionLink={actions.deleteTransactionLink}
        onOpenTransactionLink={() => navigation.navigate('LinkTransaction', { transactionId })}
        onOpenCategorySelect={openCategorySelect}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function LinkTransactionRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'LinkTransaction'>();
  const { snapshot, actions } = useRainproofDataContext();

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  return (
    <ComposerRouteScaffold screenKey="linkTransaction">
      <LinkTransactionScreen
        snapshot={snapshot}
        transactionId={route.params.transactionId}
        onAddTransactionLink={actions.addTransactionLink}
        onUpdateTransactionLink={actions.updateTransactionLink}
        onDeleteTransactionLink={actions.deleteTransactionLink}
        onBack={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function StatsDrilldownRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'StatsDrilldown'>();
  const { snapshot } = useRainproofDataContext();

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  return (
    <RouteSafeArea testID="screen-statsDrilldown">
      <StatsDrilldownScreen
        snapshot={snapshot}
        params={route.params}
        onOpenTransaction={(transactionId) => navigation.navigate('EditTransaction', { transactionId })}
        onBack={() => navigation.goBack()}
      />
    </RouteSafeArea>
  );
}

export function RainyDayFundRouteScreen() {
  const navigation = useRootStackNavigation();
  const { snapshot, derived, actions } = useRainproofDataContext();

  if (!snapshot || !derived.rainyDayProgress) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  return (
    <RouteSafeArea testID="screen-rainyDayFund">
      <RouteTopBar title="Rainy day fund" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.rainyDayContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <RainyDayFundScreen
          snapshot={snapshot}
          accountBalances={derived.accountBalances}
          rainyDayProgress={derived.rainyDayProgress}
          onUpdateRainyDayFund={actions.updateRainyDayFund}
          showHeader={false}
        />
      </ScrollView>
    </RouteSafeArea>
  );
}

export function AddBudgetRouteScreen() {
  const navigation = useRootStackNavigation();
  const { snapshot, actions } = useRainproofDataContext();
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  return (
    <ComposerRouteScaffold screenKey="addBudget">
      <BudgetFormScreen
        mode="add"
        snapshot={snapshot}
        onAddBudget={actions.addBudget}
        onOpenCategorySelect={openCategorySelect}
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
  const openCategorySelect = useOpenCategorySelect(navigation);

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
        onOpenCategorySelect={openCategorySelect}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function AddRecurringItemRouteScreen() {
  const navigation = useRootStackNavigation();
  const { snapshot, actions } = useRainproofDataContext();
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  return (
    <ComposerRouteScaffold screenKey="addRecurringItem">
      <RecurringItemFormScreen
        mode="add"
        snapshot={snapshot}
        onAddRecurringItem={actions.addRecurringItem}
        onOpenCategorySelect={openCategorySelect}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function EditRecurringItemRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'EditRecurringItem'>();
  const { snapshot, actions } = useRainproofDataContext();
  const recurringItem = findRouteItemById(snapshot?.recurringItems, route.params.recurringItemId);
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  if (!recurringItem) {
    return <RouteMessageShell message="Recurring item not found." />;
  }

  return (
    <ComposerRouteScaffold screenKey="editRecurringItem">
      <RecurringItemFormScreen
        mode="edit"
        snapshot={snapshot}
        recurringItem={recurringItem}
        onUpdateRecurringItem={actions.updateRecurringItem}
        onArchiveRecurringItem={actions.archiveRecurringItem}
        onOpenCategorySelect={openCategorySelect}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function CreateRecurringTransactionRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'CreateRecurringTransaction'>();
  const { snapshot, actions } = useRainproofDataContext();
  const recurringItem = findRouteItemById(snapshot?.recurringItems, route.params.recurringItemId);
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  if (!recurringItem) {
    return <RouteMessageShell message="Recurring item not found." />;
  }

  if (!recurringItem.isActive) {
    return <RouteMessageShell message="Recurring item is archived." />;
  }

  return (
    <ComposerRouteScaffold screenKey="createRecurringTransaction">
      <RecurringTransactionReviewScreen
        snapshot={snapshot}
        recurringItem={recurringItem}
        onAddTransaction={actions.addTransaction}
        onUpdateRecurringItem={actions.updateRecurringItem}
        onOpenCategorySelect={openCategorySelect}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function AddTransactionTemplateRouteScreen() {
  const navigation = useRootStackNavigation();
  const { snapshot, actions } = useRainproofDataContext();
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  return (
    <ComposerRouteScaffold screenKey="addTransactionTemplate">
      <TransactionTemplateFormScreen
        mode="add"
        snapshot={snapshot}
        onAddTemplate={actions.addTransactionTemplate}
        onOpenCategorySelect={openCategorySelect}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function EditTransactionTemplateRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'EditTransactionTemplate'>();
  const { snapshot, actions } = useRainproofDataContext();
  const template = findRouteItemById(snapshot?.transactionTemplates, route.params.templateId);
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  if (!template) {
    return <RouteMessageShell message="Transaction template not found." />;
  }

  return (
    <ComposerRouteScaffold screenKey="editTransactionTemplate">
      <TransactionTemplateFormScreen
        mode="edit"
        snapshot={snapshot}
        template={template}
        onUpdateTemplate={actions.updateTransactionTemplate}
        onArchiveTemplate={actions.archiveTransactionTemplate}
        onDeleteTemplate={actions.deleteTransactionTemplate}
        onOpenCategorySelect={openCategorySelect}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}

export function CategorySelectRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'CategorySelect'>();
  const { snapshot } = useRainproofDataContext();
  const {
    hasCategorySelectionRequest,
    resolveCategorySelectionRequest,
    unregisterCategorySelectionRequest,
  } = useCategorySelectionRequests();
  const requestId = route.params.requestId;
  const requestExists = hasCategorySelectionRequest(requestId);

  useEffect(() => {
    if (!requestExists) {
      navigation.goBack();
    }

    return () => unregisterCategorySelectionRequest(requestId);
  }, [navigation, requestExists, requestId, unregisterCategorySelectionRequest]);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  if (!requestExists) {
    return <RouteMessageShell message="Category selection expired." />;
  }

  return (
    <ComposerRouteScaffold screenKey="categorySelect">
      <CategorySelectScreen
        categories={snapshot.categories}
        kind={route.params.kind}
        selectedCategoryId={route.params.selectedCategoryId}
        selectedSubcategoryId={route.params.selectedSubcategoryId}
        selectionMode={route.params.selectionMode}
        showSuggestions={route.params.showSuggestions}
        title={route.params.title}
        transactions={snapshot.transactions}
        transactionLines={snapshot.transactionLines}
        onBack={() => navigation.goBack()}
        onCancel={() => navigation.goBack()}
        onSelect={(selection) => {
          if (resolveCategorySelectionRequest(requestId, selection)) {
            navigation.goBack();
          }
        }}
      />
    </ComposerRouteScaffold>
  );
}

export function DashboardEditRouteScreen() {
  const navigation = useRootStackNavigation();
  const { snapshot, derived, actions } = useRainproofDataContext();

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  return (
    <RouteSafeArea testID="screen-dashboardEdit">
      <RouteTopBar title="Edit Dashboard" onBack={() => navigation.goBack()} />
      <DashboardEditScreen
        availability={getDashboardCardAvailability(snapshot.budgets, derived.accountBalances, snapshot.recurringItems)}
        onOpenAddCards={() => navigation.navigate('DashboardAddCards')}
        settings={snapshot.settings.dashboardCardSettings}
        onUpdateSettings={(dashboardCardSettings) =>
          actions.updateDashboardCardSettings({ dashboardCardSettings })}
      />
    </RouteSafeArea>
  );
}

export function DashboardAddCardsRouteScreen() {
  const navigation = useRootStackNavigation();
  const { snapshot, derived, actions } = useRainproofDataContext();

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  return (
    <RouteSafeArea testID="screen-dashboardAddCards">
      <RouteTopBar title="Add cards" onBack={() => navigation.goBack()} />
      <DashboardAddCardsScreen
        availability={getDashboardCardAvailability(snapshot.budgets, derived.accountBalances, snapshot.recurringItems)}
        settings={snapshot.settings.dashboardCardSettings}
        onUpdateSettings={(dashboardCardSettings) =>
          actions.updateDashboardCardSettings({ dashboardCardSettings })}
      />
    </RouteSafeArea>
  );
}

function getDashboardCardAvailability(
  budgets: Budget[],
  accountBalances: AccountBalance[],
  recurringItems: RecurringItem[],
) {
  return {
    budgetProgress: budgets.some((budget) => budget.isActive),
    creditCards: accountBalances.some(({ account }) => account.type === 'credit_card'),
    upcomingPayments: getDashboardRecurringSummary(recurringItems).activeCount > 0,
  };
}

const styles = StyleSheet.create({
  rainyDayContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
