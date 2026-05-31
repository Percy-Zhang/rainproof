import { Text, View } from 'react-native';

import { Card, ProgressBar } from '../../components/ui';
import { formatMoney } from '../../domain/money';
import type { RainyDayProgress } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  DashboardHeaderIconAction,
  dashboardCardStyles,
} from './DashboardCardPrimitives';

export function RainyDayDashboardCard({
  rainyDayProgress,
  showCurrencyCodes,
  onOpenRainyDayFund,
}: {
  rainyDayProgress: RainyDayProgress;
  showCurrencyCodes: boolean;
  onOpenRainyDayFund: () => void;
}) {
  return (
    <Card testID="rainy-day-card" style={dashboardCardStyles.compactCard}>
      <View style={styles.rowBetween}>
        <View style={dashboardCardStyles.headerText}>
          <Text style={styles.kicker}>Rainy day fund</Text>
          <Text style={dashboardCardStyles.cardTitle}>{rainyDayProgress.percentage}% saved</Text>
        </View>
        <View style={styles.rainyHeaderAction}>
          <Text style={styles.progressAmount}>
            {formatMoney(rainyDayProgress.currentMinor, rainyDayProgress.fund.currencyCode, {
              showCurrencyCode: showCurrencyCodes,
            })}
          </Text>
          <DashboardHeaderIconAction
            accessibilityLabel="Edit rainy day fund"
            icon="create-outline"
            onPress={onOpenRainyDayFund}
            testID="dashboard-edit-rainy-day"
          />
        </View>
      </View>
      <ProgressBar percentage={rainyDayProgress.percentage} />
      <Text style={dashboardCardStyles.smallMuted}>
        Goal {formatMoney(rainyDayProgress.fund.goalMinor, rainyDayProgress.fund.currencyCode, {
          showCurrencyCode: showCurrencyCodes,
        })}
      </Text>
    </Card>
  );
}

const styles = {
  kicker: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800' as const,
    textTransform: 'uppercase' as const,
  },
  progressAmount: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900' as const,
    textAlign: 'right' as const,
  },
  rainyHeaderAction: {
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  rowBetween: {
    alignItems: 'center' as const,
    flexDirection: 'row' as const,
    gap: spacing.md,
    justifyContent: 'space-between' as const,
  },
};
