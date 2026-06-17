import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { AccountFormScreen } from '../features/accounts/AccountFormScreen';
import {
  ComposerRouteScaffold,
  PREPARING_RAINPROOF_MESSAGE,
  RouteMessageShell,
} from './RouteScaffold';
import { findRouteItemById } from './routeLookup';
import { useRootStackNavigation, useRootStackRoute } from './routeHooks';

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
