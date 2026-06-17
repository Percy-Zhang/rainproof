import { useEffect } from 'react';

import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { useCategorySelectionRequests } from '../features/categorySelection/CategorySelectionContext';
import { CategorySelectScreen } from '../features/categorySelection/CategorySelectScreen';
import {
  ComposerRouteScaffold,
  PREPARING_RAINPROOF_MESSAGE,
  RouteMessageShell,
} from './RouteScaffold';
import { useRootStackNavigation, useRootStackRoute } from './routeHooks';

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
