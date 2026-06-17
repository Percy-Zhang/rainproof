import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { RecurringItemFormScreen } from '../features/recurring/RecurringItemFormScreen';
import { RecurringTransactionReviewScreen } from '../features/recurring/RecurringTransactionReviewScreen';
import {
  ComposerRouteScaffold,
  PREPARING_RAINPROOF_MESSAGE,
  RouteMessageShell,
} from './RouteScaffold';
import { findRouteItemById } from './routeLookup';
import { useRootStackNavigation, useRootStackRoute } from './routeHooks';
import { useOpenCategorySelect } from './rootStackSelectionHooks';

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
        onCreateRecurringTransaction={actions.createRecurringTransaction}
        onOpenCategorySelect={openCategorySelect}
        onCancel={() => navigation.goBack()}
        onDone={() => navigation.goBack()}
      />
    </ComposerRouteScaffold>
  );
}
