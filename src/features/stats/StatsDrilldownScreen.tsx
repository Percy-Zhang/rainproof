import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { AppSnapshot } from '../../domain/types';
import type { RootStackParamList } from '../../navigation/routes';
import { colors } from '../../theme/tokens';
import {
  StatsDrilldownControlsCard,
  StatsDrilldownResultsCard,
  StatsDrilldownSummaryCard,
} from './StatsDrilldownCards';
import { statsDrilldownStyles as styles } from './StatsDrilldownStyles';
import { useStatsDrilldownViewModel } from './useStatsDrilldownViewModel';

type StatsDrilldownParams = RootStackParamList['StatsDrilldown'];

type StatsDrilldownScreenProps = {
  snapshot: AppSnapshot;
  params: StatsDrilldownParams;
  onOpenTransaction: (transactionId: string) => void;
  onBack: () => void;
};

export function StatsDrilldownScreen({ snapshot, params, onOpenTransaction, onBack }: StatsDrilldownScreenProps) {
  const viewModel = useStatsDrilldownViewModel({ params, snapshot });

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          testID="stats-drilldown-back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>Stats details</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StatsDrilldownSummaryCard
          currencyCode={params.currencyCode}
          reportKind={params.reportKind}
          title={viewModel.title}
          totalNetMinor={viewModel.totalNetMinor}
          transactionCount={viewModel.drilldown.lineRows.length}
        />
        <StatsDrilldownControlsCard
          displayMode={viewModel.displayMode}
          onChangeDisplayMode={viewModel.setDisplayMode}
          onChangeSort={viewModel.setSort}
          sort={viewModel.sort}
        />
        <StatsDrilldownResultsCard
          displayMode={viewModel.displayMode}
          drilldown={viewModel.drilldown}
          onOpenTransaction={onOpenTransaction}
          reportKind={params.reportKind}
          rowsShown={viewModel.rowsShown}
        />
      </ScrollView>
    </View>
  );
}
