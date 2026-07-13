import { useRainproofDataContext } from '../application/RainproofDataProvider';
import {
  buildAddTransactionPrefillFromRecurringItem,
  buildUpcomingPaymentPostSaveInput,
} from '../domain/recurringItems';
import { buildAddTransactionPrefillFromTemplate } from '../domain/transactionTemplates';
import type { AddTransactionDefaults, NewTransactionInput } from '../domain/types';
import { AddTransactionScreen } from '../features/transactions/AddTransactionScreen';
import { EditTransactionScreen } from '../features/transactions/EditTransactionScreen';
import { LinkTransactionScreen } from '../features/transactions/LinkTransactionScreen';
import {
  ComposerRouteScaffold,
  PREPARING_RAINPROOF_MESSAGE,
  RouteMessageShell,
} from './RouteScaffold';
import { findRouteItemById } from './routeLookup';
import { useRootStackNavigation, useRootStackRoute } from './routeHooks';
import { useOpenCategorySelect } from './rootStackSelectionHooks';

export function AddTransactionRouteScreen() {
  const navigation = useRootStackNavigation();
  const route = useRootStackRoute<'AddTransaction'>();
  const { snapshot, actions } = useRainproofDataContext();
  const openCategorySelect = useOpenCategorySelect(navigation);

  if (!snapshot) {
    return <RouteMessageShell message={PREPARING_RAINPROOF_MESSAGE} />;
  }

  const currentSnapshot = snapshot;
  const templateId = route.params?.templateId;
  const upcomingPaymentId = route.params?.upcomingPaymentId;
  if (templateId && upcomingPaymentId) {
    return <RouteMessageShell message="Choose either a template or an upcoming payment." />;
  }

  const template = templateId ? findRouteItemById(currentSnapshot.transactionTemplates, templateId) : undefined;
  if (templateId && !template) {
    return <RouteMessageShell message="Transaction template not found." />;
  }
  const upcomingPayment = upcomingPaymentId ? findRouteItemById(currentSnapshot.recurringItems, upcomingPaymentId) : undefined;
  if (upcomingPaymentId && !upcomingPayment) {
    return <RouteMessageShell message="Upcoming payment not found." />;
  }
  if (upcomingPayment && !upcomingPayment.isActive) {
    return <RouteMessageShell message="Upcoming payment is archived." />;
  }
  if (upcomingPayment?.completedAt) {
    return <RouteMessageShell message="Upcoming payment is already completed." />;
  }

  let initialTemplate;
  try {
    initialTemplate = template
      ? buildAddTransactionPrefillFromTemplate({
          accounts: currentSnapshot.accounts,
          template,
        })
      : upcomingPayment
        ? buildAddTransactionPrefillFromRecurringItem({
            accounts: currentSnapshot.accounts,
            categories: currentSnapshot.categories,
            item: upcomingPayment,
          })
      : undefined;
  } catch (caught) {
    return <RouteMessageShell message={caught instanceof Error ? caught.message : 'Transaction prefill needs attention.'} />;
  }

  async function handleAddTransaction(input: NewTransactionInput, defaults: AddTransactionDefaults) {
    if (!upcomingPayment) {
      await actions.addTransaction(input, defaults);
      return;
    }

    await actions.createUpcomingPaymentTransaction({
      recurringItemId: upcomingPayment.id,
      previousNextDueDate: upcomingPayment.nextDueDate,
      transactionInput: input,
      recurringItemInput: buildUpcomingPaymentPostSaveInput(upcomingPayment, currentSnapshot.accounts),
      addTransactionDefaults: defaults,
    });
  }

  return (
    <ComposerRouteScaffold screenKey="addTransaction">
      <AddTransactionScreen
        dashboardAccountIds={route.params?.dashboardAccountIds}
        initialTemplate={initialTemplate}
        snapshot={currentSnapshot}
        onAddTransaction={handleAddTransaction}
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
        onSaveTransactionLinkBatch={actions.saveTransactionLinkBatch}
        onBack={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}
