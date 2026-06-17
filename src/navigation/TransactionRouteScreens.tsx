import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { buildAddTransactionPrefillFromTemplate } from '../domain/transactionTemplates';
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
