import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { StatsDrilldownScreen } from '../features/stats/StatsDrilldownScreen';
import {
  PREPARING_RAINPROOF_MESSAGE,
  RouteMessageShell,
  RouteSafeArea,
} from './RouteScaffold';
import { useRootStackNavigation, useRootStackRoute } from './routeHooks';

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
