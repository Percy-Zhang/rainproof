import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, ProgressBar } from '../../components/ui';
import { getAccountDisplayName, getTransparentColor } from '../../domain/accountThemes';
import { defaultCategories } from '../../domain/categories';
import {
  getDashboardAccountPreview,
  getDashboardInitialSelectedAccountIds,
  getDashboardRecentTransactions,
  getDashboardSelectedAccountIds,
  toggleDashboardAccountSelection,
} from '../../domain/dashboard';
import {
  formatCreditCardBalanceLabel,
  formatCreditCardUtilization,
  getCreditCardBalanceSummary,
  getCreditCardPortfolioSummary,
  type CreditCardBalanceSummary,
  type CreditCardCurrencySummary,
} from '../../domain/creditCards';
import { formatMoney } from '../../domain/money';
import type {
  Account,
  AccountBalance,
  AppSnapshot,
  RainyDayProgress,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { CompactTransactionListItem } from '../transactions/TransactionListItems';

type DashboardScreenProps = {
  snapshot: AppSnapshot;
  accountBalances: AccountBalance[];
  rainyDayProgress: RainyDayProgress;
  onAddAccount: () => void;
  onOpenRainyDayFund: () => void;
  onOpenTransactions: () => void;
  onOpenTransaction: (transactionId: string) => void;
  onOpenAccount: () => void;
  onUpdateSelectedAccountIds: (accountIds: string[]) => Promise<void>;
};

export function DashboardScreen({
  snapshot,
  accountBalances,
  rainyDayProgress,
  onAddAccount,
  onOpenRainyDayFund,
  onOpenTransactions,
  onOpenTransaction,
  onOpenAccount,
  onUpdateSelectedAccountIds,
}: DashboardScreenProps) {
  const hasAnyAccounts = snapshot.accounts.length > 0;
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const categories = snapshot.categories ?? defaultCategories;
  const [selectedAccountIds, setSelectedAccountIds] = useState(() =>
    getDashboardSelectedAccountIds(accountBalances, snapshot.settings.dashboardSelectedAccountIds),
  );
  const accountPreview = useMemo(() => getDashboardAccountPreview(accountBalances), [accountBalances]);
  const previewAccountIds = useMemo(
    () => accountPreview.map(({ account }) => account.id),
    [accountPreview],
  );
  const recentTransactions = useMemo(
    () =>
      getDashboardRecentTransactions({
        previewAccountIds,
        snapshot,
        selectedAccountIds,
      }),
    [previewAccountIds, selectedAccountIds, snapshot],
  );
  const creditCardSummaries = useMemo(
    () => getCreditCardPortfolioSummary(accountBalances),
    [accountBalances],
  );

  useEffect(() => {
    setSelectedAccountIds((currentIds) => {
      const nextIds =
        snapshot.settings.dashboardSelectedAccountIds === null
          ? getDashboardInitialSelectedAccountIds(accountBalances)
          : getDashboardSelectedAccountIds(accountBalances, snapshot.settings.dashboardSelectedAccountIds);
      return areSameIds(currentIds, nextIds) ? currentIds : nextIds;
    });
  }, [accountBalances, snapshot.settings.dashboardSelectedAccountIds]);

  function toggleAccount(accountId: string) {
    setSelectedAccountIds((currentIds) => {
      const nextIds = toggleDashboardAccountSelection(currentIds, accountId);
      void onUpdateSelectedAccountIds(nextIds);
      return nextIds;
    });
  }

  return (
    <View style={styles.stack}>
      <Card testID="rainy-day-card" style={styles.compactCard}>
        <View style={styles.rowBetween}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>Rainy day fund</Text>
            <Text style={styles.cardTitle}>{rainyDayProgress.percentage}% saved</Text>
          </View>
          <View style={styles.rainyHeaderAction}>
            <Text style={styles.progressAmount}>
              {formatMoney(rainyDayProgress.currentMinor, rainyDayProgress.fund.currencyCode, {
                showCurrencyCode: showCurrencyCodes,
              })}
            </Text>
            <HeaderIconAction
              accessibilityLabel="Edit rainy day fund"
              icon="create-outline"
              onPress={onOpenRainyDayFund}
              testID="dashboard-edit-rainy-day"
            />
          </View>
        </View>
        <ProgressBar percentage={rainyDayProgress.percentage} />
        <Text style={styles.smallMuted}>
          Goal {formatMoney(rainyDayProgress.fund.goalMinor, rainyDayProgress.fund.currencyCode, {
            showCurrencyCode: showCurrencyCodes,
          })}
        </Text>
      </Card>

      <Card testID="dashboard-accounts-card" style={styles.compactCard}>
        <View style={styles.sectionCardHeader}>
          <Text style={styles.cardTitle}>Accounts</Text>
          <HeaderIconAction
            accessibilityLabel="Manage accounts"
            icon="settings-outline"
            onPress={onOpenAccount}
            testID="dashboard-manage-accounts"
          />
        </View>

        {accountPreview.length ? (
          <View style={styles.accountGrid}>
            {accountPreview.map(({ account, balanceMinor }) => (
              <AccountTile
                key={account.id}
                account={account}
                balanceMinor={balanceMinor}
                selected={selectedAccountIds.includes(account.id)}
                showCurrencyCodes={showCurrencyCodes}
                onPress={() => toggleAccount(account.id)}
              />
            ))}
          </View>
        ) : (
          <DashboardAccountsEmptyState
            hasAnyAccounts={hasAnyAccounts}
            onAddAccount={onAddAccount}
            onOpenAccount={onOpenAccount}
          />
        )}
      </Card>

      {creditCardSummaries.length ? (
        <Card testID="dashboard-credit-cards-card" style={styles.compactCard}>
          <View style={styles.sectionCardHeader}>
            <Text style={styles.cardTitle}>Credit cards</Text>
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
      ) : null}

      <Card testID="recent-transactions-card" style={styles.compactCard}>
        <View style={styles.sectionCardHeader}>
          <Text style={styles.cardTitle}>Recent transactions</Text>
          <HeaderAction label="More" onPress={onOpenTransactions} testID="dashboard-more-transactions" />
        </View>
        {recentTransactions.length ? (
          <View style={styles.compactRows}>
            {recentTransactions.map((entry, index) => (
              <CompactTransactionListItem
                key={entry.id}
                entry={entry}
                accounts={snapshot.accounts}
                categories={categories}
                first={index === 0}
                contextAccountId={selectedAccountIds.length === 1 ? selectedAccountIds[0] : undefined}
                showCurrencyCodes={showCurrencyCodes}
                onPress={() => onOpenTransaction(entry.transaction.id)}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            {selectedAccountIds.length ? 'No recent transactions for selected accounts.' : 'No accounts selected.'}
          </Text>
        )}
      </Card>

    </View>
  );
}

function DashboardAccountsEmptyState({
  hasAnyAccounts,
  onAddAccount,
  onOpenAccount,
}: {
  hasAnyAccounts: boolean;
  onAddAccount: () => void;
  onOpenAccount: () => void;
}) {
  if (hasAnyAccounts) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onOpenAccount}
        style={({ pressed }) => [styles.emptyAccountCard, pressed && styles.pressedRow]}
        testID="dashboard-hidden-accounts"
      >
        <Ionicons name="eye-off-outline" size={26} color={colors.primaryDark} />
        <Text style={styles.emptyAccountTitle}>All accounts are hidden</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onAddAccount}
      style={({ pressed }) => [styles.emptyAccountCard, pressed && styles.pressedRow]}
      testID="dashboard-add-first-account"
    >
      <Ionicons name="add" size={26} color={colors.primaryDark} />
      <Text style={styles.emptyAccountTitle}>Add your first account</Text>
    </Pressable>
  );
}

function areSameIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function HeaderAction({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.headerAction, pressed && styles.pressedRow]}
    >
      <Text style={styles.headerActionText}>{label}</Text>
    </Pressable>
  );
}

function HeaderIconAction({
  accessibilityLabel,
  icon,
  onPress,
  testID,
}: {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.headerIconAction, pressed && styles.pressedRow]}
    >
      <Ionicons name={icon} size={19} color={colors.primaryDark} />
    </Pressable>
  );
}

function AccountTile({
  account,
  balanceMinor,
  selected,
  showCurrencyCodes,
  onPress,
}: {
  account: Account;
  balanceMinor: number;
  selected: boolean;
  showCurrencyCodes: boolean;
  onPress: () => void;
}) {
  const creditCardSummary = getCreditCardBalanceSummary({ account, balanceMinor });
  const balanceLabel = creditCardSummary
    ? formatCreditCardBalanceLabel({ account, balanceMinor }, { showCurrencyCode: showCurrencyCodes })
    : formatMoney(balanceMinor, account.currencyCode, { showCurrencyCode: showCurrencyCodes });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={`dashboard-account-${account.id}`}
      style={({ pressed }) => [
        styles.accountTile,
        {
          backgroundColor: selected ? getTransparentColor(account.themeColor, '38') : colors.surface,
          borderColor: selected ? account.themeColor : getTransparentColor(account.themeColor, '99'),
          borderLeftColor: account.themeColor,
        },
        pressed && styles.pressedRow,
      ]}
    >
      <Text numberOfLines={1} style={styles.accountName}>{getAccountDisplayName(account)}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.accountBalance}>
        {balanceLabel}
      </Text>
    </Pressable>
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

function CreditMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.creditMetric}>
      <Text style={styles.creditMetricLabel}>{label}</Text>
      <Text style={styles.creditMetricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  compactCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  kicker: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 30,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  headerAction: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerActionText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  headerIconAction: {
    alignItems: 'center',
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  progressAmount: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  rainyHeaderAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  smallMuted: {
    color: colors.muted,
    fontSize: typography.small,
  },
  accountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  accountTile: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 5,
    gap: spacing.xs,
    minHeight: 62,
    padding: spacing.sm,
    width: '48%',
  },
  accountName: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '800',
    textAlign: 'right',
    width: '100%',
  },
  accountBalance: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
    width: '100%',
  },
  compactRows: {
    gap: 0,
  },
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
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  emptyAccountCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 92,
    padding: spacing.md,
  },
  emptyAccountTitle: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  pressedRow: {
    opacity: 0.78,
  },
});
