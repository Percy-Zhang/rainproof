import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccountSelectorAction } from '../../components/CompactAccountSelector';
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

export const AccountsDashboardCard = memo(function AccountsDashboardCard({
  accountPreview,
  hasAnyAccounts,
  selectedAccountIds,
  showCurrencyCodes,
  onAddAccount,
  onClearSelection,
  onOpenAccount,
  onSelectAll,
  onToggleAccount,
}: {
  accountPreview: AccountBalance[];
  hasAnyAccounts: boolean;
  selectedAccountIds: string[];
  showCurrencyCodes: boolean;
  onAddAccount: () => void;
  onClearSelection: () => void;
  onOpenAccount: () => void;
  onSelectAll: () => void;
  onToggleAccount: (accountId: string) => void;
}) {
  const selectedAccountIdSet = new Set(selectedAccountIds);
  const allSelected = accountPreview.length > 0 &&
    accountPreview.every(({ account }) => selectedAccountIdSet.has(account.id));
  return (
    <Card testID="dashboard-accounts-card" style={dashboardCardStyles.compactCard}>
      <View style={dashboardCardStyles.sectionCardHeader}>
        <Text numberOfLines={1} style={[dashboardCardStyles.cardTitle, styles.headerTitle]}>Accounts</Text>
        <View style={styles.headerActions}>
          {accountPreview.length ? (
            <>
              <AccountSelectorAction disabled={allSelected} label="All" onPress={onSelectAll} />
              <AccountSelectorAction disabled={!selectedAccountIds.length} label="None" onPress={onClearSelection} />
            </>
          ) : null}
          <DashboardHeaderIconAction
            accessibilityLabel="Manage accounts"
            icon="settings-outline"
            onPress={onOpenAccount}
            testID="dashboard-manage-accounts"
          />
        </View>
      </View>

      {accountPreview.length ? (
        <View style={styles.accountGrid}>
          {accountPreview.map(({ account, balanceMinor }) => (
            <AccountTile
              key={account.id}
              account={account}
              balanceMinor={balanceMinor}
              selected={selectedAccountIdSet.has(account.id)}
              showCurrencyCodes={showCurrencyCodes}
              onToggleAccount={onToggleAccount}
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
});

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

const AccountTile = memo(function AccountTile({
  account,
  balanceMinor,
  selected,
  showCurrencyCodes,
  onToggleAccount,
}: {
  account: Account;
  balanceMinor: number;
  selected: boolean;
  showCurrencyCodes: boolean;
  onToggleAccount: (accountId: string) => void;
}) {
  const creditCardSummary = getCreditCardBalanceSummary({ account, balanceMinor });
  const balanceLabel = creditCardSummary
    ? formatCreditCardBalanceLabel({ account, balanceMinor }, { showCurrencyCode: showCurrencyCodes })
    : formatMoney(balanceMinor, account.currencyCode, { showCurrencyCode: showCurrencyCodes });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onToggleAccount(account.id)}
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
});

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
  headerActions: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  headerTitle: {
    flexShrink: 0,
  },
});
