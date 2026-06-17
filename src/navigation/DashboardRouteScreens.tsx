import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { getDashboardRecurringSummary } from '../domain/dashboardRecurring';
import type { AccountBalance, Budget, RecurringItem } from '../domain/types';
import {
  DashboardAddCardsScreen,
  DashboardEditScreen,
} from '../features/dashboard/DashboardCardCustomizationScreens';
import {
  PREPARING_RAINPROOF_MESSAGE,
  RouteMessageShell,
  RouteSafeArea,
  RouteTopBar,
} from './RouteScaffold';
import { useRootStackNavigation } from './routeHooks';

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
