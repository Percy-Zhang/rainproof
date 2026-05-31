import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../../components/ui';
import { getAccountDisplayName, getTransparentColor } from '../../domain/accountThemes';
import {
  formatCreditCardBalanceLabel,
  getCreditCardBalanceSummary,
} from '../../domain/creditCards';
import { formatMoney } from '../../domain/money';
import type { Account, AccountBalance } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import {
  DashboardHeaderIconAction,
  dashboardCardStyles,
} from './DashboardCardPrimitives';

export function AccountsDashboardCard({
  accountPreview,
  hasAnyAccounts,
  selectedAccountIds,
  showCurrencyCodes,
  onAddAccount,
  onOpenAccount,
  onToggleAccount,
}: {
  accountPreview: AccountBalance[];
  hasAnyAccounts: boolean;
  selectedAccountIds: string[];
  showCurrencyCodes: boolean;
  onAddAccount: () => void;
  onOpenAccount: () => void;
  onToggleAccount: (accountId: string) => void;
}) {
  return (
    <Card testID="dashboard-accounts-card" style={dashboardCardStyles.compactCard}>
      <View style={dashboardCardStyles.sectionCardHeader}>
        <Text style={dashboardCardStyles.cardTitle}>Accounts</Text>
        <DashboardHeaderIconAction
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
              onPress={() => onToggleAccount(account.id)}
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
        style={({ pressed }) => [styles.emptyAccountCard, pressed && dashboardCardStyles.pressedRow]}
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
      style={({ pressed }) => [styles.emptyAccountCard, pressed && dashboardCardStyles.pressedRow]}
      testID="dashboard-add-first-account"
    >
      <Ionicons name="add" size={26} color={colors.primaryDark} />
      <Text style={styles.emptyAccountTitle}>Add your first account</Text>
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
        pressed && dashboardCardStyles.pressedRow,
      ]}
    >
      <Text numberOfLines={1} style={styles.accountName}>{getAccountDisplayName(account)}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.accountBalance}>
        {balanceLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  accountBalance: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
    width: '100%',
  },
  accountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  accountName: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '800',
    textAlign: 'right',
    width: '100%',
  },
  accountTile: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderLeftWidth: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 62,
    padding: spacing.sm,
    width: '48%',
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
});
