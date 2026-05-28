import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { ProgressBar } from '../../components/ui';
import type { DashboardCardId } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type DashboardCardPreviewProps = {
  cardId: DashboardCardId;
  disabled?: boolean;
};

export function DashboardCardPreview({ cardId, disabled = false }: DashboardCardPreviewProps) {
  return (
    <View style={[styles.previewSurface, disabled && styles.disabled]} testID={`dashboard-card-preview-${cardId}`}>
      {renderPreviewContent(cardId)}
    </View>
  );
}

function renderPreviewContent(cardId: DashboardCardId) {
  switch (cardId) {
    case 'rainyDay':
      return (
        <View style={styles.previewStack}>
          <View style={styles.previewRow}>
            <Text style={styles.kicker}>Rainy day fund</Text>
            <Text style={styles.previewStrong}>64%</Text>
          </View>
          <ProgressBar percentage={64} />
          <Text style={styles.previewMuted}>$3,200 saved of $5,000</Text>
        </View>
      );
    case 'accounts':
      return (
        <View style={styles.tileGrid}>
          <View style={[styles.accountTile, styles.accountTilePrimary]}>
            <Text style={styles.previewMuted}>Everyday</Text>
            <Text style={styles.previewStrong}>$2,480</Text>
          </View>
          <View style={styles.accountTile}>
            <Text style={styles.previewMuted}>Savings</Text>
            <Text style={styles.previewStrong}>$8,900</Text>
          </View>
        </View>
      );
    case 'recentTransactions':
      return (
        <View style={styles.previewStack}>
          <PreviewTransactionRow icon="cafe-outline" label="Coffee" amount="-$5.80" />
          <PreviewTransactionRow icon="cart-outline" label="Groceries" amount="-$84.20" />
        </View>
      );
    case 'cashFlow':
      return (
        <View style={styles.metricGrid}>
          <PreviewMetric label="Income" value="$4,800" tone="income" />
          <PreviewMetric label="Spending" value="$2,150" tone="expense" />
          <PreviewMetric label="Net" value="$2,650" tone="income" />
        </View>
      );
    case 'budgetProgress':
      return (
        <View style={styles.previewStack}>
          <PreviewProgressRow label="Groceries" percent={82} amount="$410 / $500" />
          <PreviewProgressRow label="Dining" percent={108} amount="$216 / $200" />
        </View>
      );
    case 'upcomingPayments':
      return (
        <View style={styles.previewStack}>
          <PreviewDueRow label="Rent" amount="$2,150" due="Overdue" tone="overdue" />
          <PreviewDueRow label="Streaming" amount="$18.99" due="Due soon" tone="soon" />
          <PreviewDueRow label="Salary" amount="$3,200" due="Upcoming" tone="upcoming" />
        </View>
      );
    case 'topSpending':
      return (
        <View style={styles.previewStack}>
          <PreviewCategoryRow color="#2E7D62" icon="cart-outline" label="Groceries" amount="$410" />
          <PreviewCategoryRow color="#B95C42" icon="restaurant-outline" label="Dining" amount="$216" />
        </View>
      );
    case 'creditCards':
      return (
        <View style={styles.previewStack}>
          <View style={styles.previewRow}>
            <Text style={styles.previewMuted}>Total owed</Text>
            <Text style={styles.previewStrong}>$850</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewMuted}>Available</Text>
            <Text style={styles.previewStrong}>$4,150</Text>
          </View>
          <ProgressBar percentage={17} />
        </View>
      );
    case 'balanceSummary':
      return (
        <View style={styles.previewStack}>
          <View style={styles.previewRow}>
            <Text style={styles.previewMuted}>AUD total</Text>
            <Text style={styles.previewStrong}>$11,380</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewMuted}>USD total</Text>
            <Text style={styles.previewStrong}>$620</Text>
          </View>
        </View>
      );
    default:
      return null;
  }
}

function PreviewDueRow({
  amount,
  due,
  label,
  tone,
}: {
  amount: string;
  due: string;
  label: string;
  tone: 'overdue' | 'soon' | 'upcoming';
}) {
  return (
    <View style={styles.previewRow}>
      <View style={styles.previewDueText}>
        <Text style={styles.previewLabel}>{label}</Text>
        <Text style={[styles.previewMuted, getPreviewDueToneStyle(tone)]}>{due}</Text>
      </View>
      <Text style={styles.previewStrong}>{amount}</Text>
    </View>
  );
}

function PreviewMetric({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'expense' | 'income';
  value: string;
}) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.previewMuted}>{label}</Text>
      <Text style={[styles.previewStrong, tone === 'income' ? styles.income : styles.expense]}>{value}</Text>
    </View>
  );
}

function getPreviewDueToneStyle(tone: 'overdue' | 'soon' | 'upcoming') {
  switch (tone) {
    case 'overdue':
      return styles.expense;
    case 'soon':
      return styles.warning;
    case 'upcoming':
      return styles.primary;
  }
}

function PreviewProgressRow({
  amount,
  label,
  percent,
}: {
  amount: string;
  label: string;
  percent: number;
}) {
  return (
    <View style={styles.previewStackTiny}>
      <View style={styles.previewRow}>
        <Text style={styles.previewLabel}>{label}</Text>
        <Text style={styles.previewMuted}>{amount}</Text>
      </View>
      <ProgressBar percentage={Math.min(percent, 100)} />
    </View>
  );
}

function PreviewTransactionRow({
  amount,
  icon,
  label,
}: {
  amount: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.previewRow}>
      <CategoryIconBadge color={colors.primary} icon={icon} size="sm" />
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewStrong}>{amount}</Text>
    </View>
  );
}

function PreviewCategoryRow({
  amount,
  color,
  icon,
  label,
}: {
  amount: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.previewRow}>
      <CategoryIconBadge color={color} icon={icon} size="sm" />
      <Text style={styles.previewLabel}>{label}</Text>
      <Text style={styles.previewStrong}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  accountTile: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderLeftColor: colors.primary,
    borderLeftWidth: 4,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    padding: spacing.sm,
  },
  accountTilePrimary: {
    backgroundColor: colors.surfaceMuted,
  },
  disabled: {
    opacity: 0.64,
  },
  expense: {
    color: colors.danger,
  },
  income: {
    color: colors.success,
  },
  primary: {
    color: colors.primaryDark,
  },
  kicker: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricBox: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 84,
    padding: spacing.sm,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  previewLabel: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '800',
  },
  previewDueText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  previewMuted: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  previewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  previewStack: {
    gap: spacing.sm,
  },
  previewStackTiny: {
    gap: spacing.xs,
  },
  previewStrong: {
    color: colors.ink,
    flexShrink: 0,
    fontSize: typography.small,
    fontWeight: '900',
  },
  previewSurface: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  tileGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  warning: {
    color: '#9B6B12',
  },
});
