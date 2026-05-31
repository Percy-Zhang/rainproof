import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui';
import { getDashboardCardDefinition } from '../../domain/dashboardCards';
import { formatLongDateLabel } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import type { Account, UpcomingRecurringItem } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { dashboardCardStyles } from './DashboardCardPrimitives';

export function UpcomingPaymentsDashboardCard({
  accountById,
  rows,
  showCurrencyCodes,
  onOpenRecurring,
}: {
  accountById: Map<string, Account>;
  rows: UpcomingRecurringItem[];
  showCurrencyCodes: boolean;
  onOpenRecurring: () => void;
}) {
  if (!rows.length) {
    return null;
  }

  return (
    <Card testID="dashboard-upcoming-payments-card" style={dashboardCardStyles.compactCard}>
      <Pressable
        accessibilityRole="button"
        onPress={onOpenRecurring}
        style={({ pressed }) => [styles.upcomingPaymentsContent, pressed && dashboardCardStyles.pressedRow]}
      >
        <View style={dashboardCardStyles.sectionCardHeader}>
          <View style={dashboardCardStyles.headerText}>
            <Text style={dashboardCardStyles.cardTitle}>{getDashboardCardDefinition('upcomingPayments').title}</Text>
            <Text style={dashboardCardStyles.smallMuted}>Recurring items that need attention next.</Text>
          </View>
          <Text style={dashboardCardStyles.headerActionText}>View</Text>
        </View>

        <View style={styles.upcomingPaymentRows}>
          {rows.map((item) => (
            <UpcomingPaymentRow
              key={item.id}
              account={accountById.get(item.accountId)}
              item={item}
              showCurrencyCodes={showCurrencyCodes}
            />
          ))}
        </View>
      </Pressable>
    </Card>
  );
}

function UpcomingPaymentRow({
  account,
  item,
  showCurrencyCodes,
}: {
  account?: Account;
  item: UpcomingRecurringItem;
  showCurrencyCodes: boolean;
}) {
  const status = getRecurringDashboardStatus(item);
  const amountTone = item.kind === 'income' ? colors.success : colors.danger;
  const kindLabel = item.kind === 'income' ? 'Receive' : 'Pay';

  return (
    <View style={styles.upcomingPaymentRow}>
      <View style={styles.upcomingPaymentText}>
        <Text numberOfLines={1} style={styles.upcomingPaymentName}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.upcomingPaymentDetail}>
          {kindLabel} {formatLongDateLabel(item.nextDueDate)}
          {account ? ` / ${account.name}` : ''}
        </Text>
      </View>
      <View style={styles.upcomingPaymentTrailing}>
        <Text style={[styles.upcomingPaymentAmount, { color: amountTone }]}>
          {formatMoney(item.amountMinor, item.currencyCode, { showCurrencyCode: showCurrencyCodes })}
        </Text>
        <Text style={[styles.upcomingPaymentStatus, { color: status.color }]}>{status.label}</Text>
      </View>
    </View>
  );
}

function getRecurringDashboardStatus(item: UpcomingRecurringItem): { label: string; color: string } {
  switch (item.dueStatus) {
    case 'overdue':
      return { label: 'Overdue', color: colors.danger };
    case 'due_soon':
      return { label: 'Due soon', color: '#9B6B12' };
    case 'upcoming':
      return { label: 'Upcoming', color: colors.primaryDark };
  }
}

const styles = StyleSheet.create({
  upcomingPaymentAmount: {
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  upcomingPaymentDetail: {
    color: colors.muted,
    fontSize: typography.small,
  },
  upcomingPaymentName: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  upcomingPaymentRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  upcomingPaymentRows: {
    gap: spacing.sm,
  },
  upcomingPaymentStatus: {
    fontSize: typography.small,
    fontWeight: '900',
    textAlign: 'right',
  },
  upcomingPaymentText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  upcomingPaymentTrailing: {
    alignItems: 'flex-end',
    flexShrink: 0,
    gap: 2,
  },
  upcomingPaymentsContent: {
    gap: spacing.sm,
  },
});
