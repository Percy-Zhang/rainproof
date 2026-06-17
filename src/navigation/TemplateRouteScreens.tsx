import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { TransactionTemplateFormScreen } from '../features/templates/TransactionTemplateFormScreen';
import {
  ComposerRouteScaffold,
  PREPARING_RAINPROOF_MESSAGE,
  RouteMessageShell,
} from './RouteScaffold';
import { findRouteItemById } from './routeLookup';
import { useRootStackNavigation, useRootStackRoute } from './routeHooks';
import { useOpenCategorySelect } from './rootStackSelectionHooks';

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
