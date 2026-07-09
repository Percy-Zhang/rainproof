import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { AccountSelectorAction } from '../../components/CompactAccountSelector';
import { Card } from '../../components/ui';
import {
  type AccountSelectionMap,
  useImmediateAccountSelection,
  useTapIntentPressHandlers,
} from '../../components/useImmediateAccountSelection';
import { getAccountDisplayName, getTransparentColor } from '../../domain/accountThemes';
import {
  formatCreditCardBalanceLabel,
  getCreditCardBalanceSummary,
} from '../../domain/creditCards';
import { formatMoney } from '../../domain/money';
import type { Account, AccountBalance } from '../../domain/types';
import {
  getResponsiveAccountColumnsForItemCount,
  getResponsiveAccountTileBasisForColumns,
  RESPONSIVE_ACCOUNT_TILE_MIN_WIDTH,
} from '../../theme/responsiveLayout';
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
  onOpenAccount,
  onSelectedAccountIdsChange,
}: {
  accountPreview: AccountBalance[];
  hasAnyAccounts: boolean;
  selectedAccountIds: string[];
  showCurrencyCodes: boolean;
  onAddAccount: () => void;
  onOpenAccount: () => void;
  onSelectedAccountIdsChange: (accountIds: string[]) => void;
}) {
  const { width } = useWindowDimensions();
  const accountColumns = getResponsiveAccountColumnsForItemCount(width, accountPreview.length);
  const tileBasis = getResponsiveAccountTileBasisForColumns(accountColumns);
  const accountIds = accountPreview.map(({ account }) => account.id);
  const immediateSelection = useImmediateAccountSelection({
    onApplySelectedAccountIds: onSelectedAccountIdsChange,
    selectedAccountIds,
  });
  const visualSelectedAccountIds = immediateSelection.selectedAccountIds;
  const selectedAccountIdSet = new Set(visualSelectedAccountIds);
  const allSelected = accountPreview.length > 0 &&
    accountPreview.every(({ account }) => selectedAccountIdSet.has(account.id));
  const handleCancelSelectionPreview = useCallback(() => {
    immediateSelection.cancelSelectionPreview();
  }, [immediateSelection]);

  return (
    <Card testID="dashboard-accounts-card" style={dashboardCardStyles.compactCard}>
      <View style={dashboardCardStyles.sectionCardHeader}>
        <Text numberOfLines={1} style={[dashboardCardStyles.cardTitle, styles.headerTitle]}>Accounts</Text>
        <View style={styles.headerActions}>
          {accountPreview.length ? (
            <>
              <AccountSelectorAction
                disabled={allSelected}
                immediate
                label="All"
                onCancelPreview={handleCancelSelectionPreview}
                onPress={() => immediateSelection.commitPreviewedSelection(() => accountIds)}
                onPreviewPress={() => immediateSelection.previewSelectedAccountIds(accountIds)}
              />
              <AccountSelectorAction
                disabled={!visualSelectedAccountIds.length}
                immediate
                label="None"
                onCancelPreview={handleCancelSelectionPreview}
                onPress={() => immediateSelection.commitPreviewedSelection(() => [])}
                onPreviewPress={() => immediateSelection.previewSelectedAccountIds([])}
              />
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
              onCancelPreview={handleCancelSelectionPreview}
              onPressCommit={() =>
                immediateSelection.commitPreviewedSelection(() => immediateSelection.getToggledAccountIds(account.id))}
              onPreviewPress={() => immediateSelection.previewToggleAccount(account.id)}
              selected={selectedAccountIdSet.has(account.id)}
              showCurrencyCodes={showCurrencyCodes}
              tileBasis={tileBasis}
              visualSelectedAccountIdMap={immediateSelection.visualSelectedAccountIdMap}
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
  tileBasis,
  visualSelectedAccountIdMap,
  onCancelPreview,
  onPressCommit,
  onPreviewPress,
}: {
  account: Account;
  balanceMinor: number;
  onCancelPreview: () => void;
  onPressCommit: () => void;
  onPreviewPress: () => void;
  selected: boolean;
  showCurrencyCodes: boolean;
  tileBasis: AccountTileBasis;
  visualSelectedAccountIdMap: SharedValue<AccountSelectionMap>;
}) {
  const creditCardSummary = getCreditCardBalanceSummary({ account, balanceMinor });
  const balanceLabel = creditCardSummary
    ? formatCreditCardBalanceLabel({ account, balanceMinor }, { showCurrencyCode: showCurrencyCodes })
    : formatMoney(balanceMinor, account.currencyCode, { showCurrencyCode: showCurrencyCodes });
  const accountName = getAccountDisplayName(account);
  const selectedBackgroundColor = getTransparentColor(account.themeColor, '38');
  const unselectedBorderColor = getTransparentColor(account.themeColor, '99');
  const animatedSelectionStyle = useAnimatedStyle(() => {
    const visuallySelected = Boolean(visualSelectedAccountIdMap.value[account.id]);
    return {
      backgroundColor: visuallySelected ? selectedBackgroundColor : colors.surface,
      borderColor: visuallySelected ? account.themeColor : unselectedBorderColor,
    };
  }, [account.id, account.themeColor, selectedBackgroundColor, unselectedBorderColor, visualSelectedAccountIdMap]);
  const pressHandlers = useTapIntentPressHandlers({
    enabled: true,
    onCancel: onCancelPreview,
    onCommit: onPressCommit,
    onPreview: onPreviewPress,
  });

  return (
    <Pressable
      accessibilityLabel={`${accountName}, ${account.currencyCode}, ${selected ? 'selected' : 'not selected'}`}
      accessibilityRole="button"
      {...pressHandlers}
      testID={`dashboard-account-${account.id}`}
      style={({ pressed }) => [styles.accountTileFrame, { width: tileBasis }, pressed && dashboardCardStyles.pressedRow]}
    >
      <Animated.View
        style={[
          styles.accountTileContent,
          { borderLeftColor: account.themeColor },
          animatedSelectionStyle,
        ]}
      >
        <Text numberOfLines={1} style={styles.accountName}>{accountName}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.accountBalance}>
          {balanceLabel}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

type AccountTileBasis = ReturnType<typeof getResponsiveAccountTileBasisForColumns>;

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
  accountTileContent: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderLeftWidth: 5,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 62,
    minWidth: RESPONSIVE_ACCOUNT_TILE_MIN_WIDTH,
    padding: spacing.sm,
    width: '100%',
  },
  accountTileFrame: {
    minHeight: 62,
    minWidth: RESPONSIVE_ACCOUNT_TILE_MIN_WIDTH,
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
