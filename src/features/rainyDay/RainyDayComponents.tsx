import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccountIconBadge } from '../../components/AccountDisplay';
import { ProgressBar } from '../../components/ui';
import { getAccountDisplayName, getTransparentColor } from '../../domain/accountThemes';
import { formatMoney } from '../../domain/money';
import type { AccountBalance, CurrencyCode, RainyDayProgress } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type RainyDayProgressCardProps = {
  currencyCode: CurrencyCode;
  hasSelectedAccounts: boolean;
  isComplete: boolean;
  progress: RainyDayProgress;
  showCurrencyCodes: boolean;
};

export function RainyDayProgressCard({
  currencyCode,
  hasSelectedAccounts,
  isComplete,
  progress,
  showCurrencyCodes,
}: RainyDayProgressCardProps) {
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressHeader}>
        <View style={styles.progressTitleBlock}>
          <Text style={styles.kicker}>{isComplete ? 'Ready for rain' : 'Progress'}</Text>
          <Text style={styles.progressTitle}>{progress.percentage}% saved</Text>
        </View>
        <Ionicons name="umbrella-outline" size={28} color={colors.primaryDark} />
      </View>
      <ProgressBar percentage={progress.percentage} />
      <View style={styles.progressNumbers}>
        <ProgressMetric
          label="Current"
          value={formatMoney(progress.currentMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })}
        />
        <ProgressMetric
          label="Threshold"
          value={formatMoney(progress.fund.goalMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })}
        />
        <ProgressMetric
          label={isComplete ? 'Completed' : 'Remaining'}
          value={formatMoney(progress.remainingMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })}
        />
      </View>
      {!hasSelectedAccounts ? (
        <Text style={styles.setupText}>Choose at least one account to start tracking progress.</Text>
      ) : null}
    </View>
  );
}

function ProgressMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.progressMetric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

type RainyAccountRowProps = {
  accountBalance: AccountBalance;
  balanceMinor: number;
  selected: boolean;
  showCurrencyCodes: boolean;
  onPress: () => void;
};

export function RainyAccountRow({
  accountBalance,
  balanceMinor,
  selected,
  showCurrencyCodes,
  onPress,
}: RainyAccountRowProps) {
  const { account } = accountBalance;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.accountRow,
        {
          backgroundColor: selected ? getTransparentColor(account.themeColor, '28') : colors.surface,
          borderColor: selected ? account.themeColor : colors.faint,
        },
        pressed && styles.pressed,
      ]}
      testID={`rainy-day-account-${account.id}`}
    >
      <AccountIconBadge account={account} size="md" />
      <View style={styles.accountMain}>
        <Text numberOfLines={1} style={styles.accountName}>{getAccountDisplayName(account)}</Text>
        <Text style={styles.accountBalance}>
          {formatMoney(balanceMinor, account.currencyCode, { showCurrencyCode: showCurrencyCodes })}
        </Text>
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? account.themeColor : colors.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  progressCard: {
    gap: spacing.md,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTitleBlock: {
    gap: spacing.xs,
  },
  kicker: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  progressTitle: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: '900',
  },
  progressNumbers: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressMetric: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  metricValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  setupText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '800',
  },
  accountRow: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
  },
  accountMain: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  accountName: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  accountBalance: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
});
