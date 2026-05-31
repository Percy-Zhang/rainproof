import { StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui';
import { getAccountDisplayName } from '../../domain/accountThemes';
import {
  formatCreditCardBalanceLabel,
  formatCreditCardUtilization,
  type CreditCardBalanceSummary,
  type CreditCardCurrencySummary,
} from '../../domain/creditCards';
import { formatMoney } from '../../domain/money';
import { colors, spacing, typography } from '../../theme/tokens';
import { dashboardCardStyles } from './DashboardCardPrimitives';

export function CreditCardsDashboardCard({
  creditCardSummaries,
  showCurrencyCodes,
}: {
  creditCardSummaries: CreditCardCurrencySummary[];
  showCurrencyCodes: boolean;
}) {
  if (!creditCardSummaries.length) {
    return null;
  }

  return (
    <Card testID="dashboard-credit-cards-card" style={dashboardCardStyles.compactCard}>
      <View style={dashboardCardStyles.sectionCardHeader}>
        <Text style={dashboardCardStyles.cardTitle}>Credit cards</Text>
      </View>
      <View style={styles.creditSummaryStack}>
        {creditCardSummaries.map((summary) => (
          <CreditCardSummaryBlock
            key={summary.currencyCode}
            showCurrencyCodes={showCurrencyCodes}
            summary={summary}
          />
        ))}
      </View>
    </Card>
  );
}

function CreditCardSummaryBlock({
  showCurrencyCodes,
  summary,
}: {
  showCurrencyCodes: boolean;
  summary: CreditCardCurrencySummary;
}) {
  return (
    <View style={styles.creditSummaryBlock}>
      <View style={styles.creditSummaryMetrics}>
        <CreditMetric
          label="Total owed"
          value={formatMoney(summary.totalOwedMinor, summary.currencyCode, { showCurrencyCode: showCurrencyCodes })}
        />
        {summary.totalAvailableCreditMinor !== null ? (
          <CreditMetric
            label={summary.totalAvailableCreditMinor < 0 ? 'Over limit' : 'Available'}
            value={formatMoney(Math.abs(summary.totalAvailableCreditMinor), summary.currencyCode, {
              showCurrencyCode: showCurrencyCodes,
            })}
          />
        ) : null}
        {summary.utilization !== null ? (
          <CreditMetric label="Utilization" value={formatCreditCardUtilization(summary.utilization) ?? ''} />
        ) : null}
      </View>
      <View style={styles.creditCardRows}>
        {summary.cards.map((card) => (
          <CreditCardSummaryRow key={card.account.id} card={card} showCurrencyCodes={showCurrencyCodes} />
        ))}
      </View>
    </View>
  );
}

function CreditCardSummaryRow({
  card,
  showCurrencyCodes,
}: {
  card: CreditCardBalanceSummary;
  showCurrencyCodes: boolean;
}) {
  const available = card.availableCreditMinor;
  const utilization = formatCreditCardUtilization(card.utilization);

  return (
    <View style={styles.creditCardRow}>
      <Text numberOfLines={1} style={styles.creditCardName}>{getAccountDisplayName(card.account)}</Text>
      <View style={styles.creditCardValues}>
        <Text numberOfLines={1} style={styles.creditCardBalance}>
          {formatCreditCardBalanceLabel(card, { showCurrencyCode: showCurrencyCodes })}
        </Text>
        {available !== null ? (
          <Text numberOfLines={1} style={styles.creditCardDetail}>
            {available < 0 ? 'Over' : 'Available'} {formatMoney(Math.abs(available), card.account.currencyCode, {
              showCurrencyCode: showCurrencyCodes,
            })}
            {utilization ? ` - ${utilization}` : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

type CreditMetricTone = 'income' | 'expense' | 'neutral';

export function CreditMetric({
  label,
  tone = 'neutral',
  value,
}: {
  label: string;
  tone?: CreditMetricTone;
  value: string;
}) {
  return (
    <View style={styles.creditMetric}>
      <Text style={styles.creditMetricLabel}>{label}</Text>
      <Text style={[styles.creditMetricValue, getCreditMetricToneStyle(tone)]}>{value}</Text>
    </View>
  );
}

export function getNetMetricTone(amountMinor: number): CreditMetricTone {
  if (amountMinor > 0) {
    return 'income';
  }
  if (amountMinor < 0) {
    return 'expense';
  }
  return 'neutral';
}

function getCreditMetricToneStyle(tone: CreditMetricTone) {
  switch (tone) {
    case 'income':
      return styles.creditMetricValueIncome;
    case 'expense':
      return styles.creditMetricValueExpense;
    case 'neutral':
      return null;
  }
}

const styles = StyleSheet.create({
  creditCardBalance: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  creditCardDetail: {
    color: colors.muted,
    fontSize: typography.small,
    textAlign: 'right',
  },
  creditCardName: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '800',
  },
  creditCardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  creditCardRows: {
    gap: spacing.xs,
  },
  creditCardValues: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  creditMetric: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 96,
    padding: spacing.sm,
  },
  creditMetricLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  creditMetricValue: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  creditMetricValueExpense: {
    color: colors.danger,
  },
  creditMetricValueIncome: {
    color: colors.success,
  },
  creditSummaryBlock: {
    gap: spacing.sm,
  },
  creditSummaryMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  creditSummaryStack: {
    gap: spacing.md,
  },
});
