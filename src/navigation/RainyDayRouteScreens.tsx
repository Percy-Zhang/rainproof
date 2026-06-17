import { ScrollView, StyleSheet } from 'react-native';

import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { RainyDayFundScreen } from '../features/rainyDay/RainyDayFundScreen';
import { spacing } from '../theme/tokens';
import {
  PREPARING_RAINPROOF_MESSAGE,
  RouteMessageShell,
  RouteSafeArea,
  RouteTopBar,
} from './RouteScaffold';
import { useRootStackNavigation } from './routeHooks';

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

const styles = StyleSheet.create({
  rainyDayContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
