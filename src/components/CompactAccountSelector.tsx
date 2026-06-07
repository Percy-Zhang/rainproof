import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getAccountDisplayName, getTransparentColor } from '../domain/accountThemes';
import {
  getAccountSelectionBalanceLabel,
  getAccountSelectionSummary,
} from '../domain/accountSelection';
import type { Account, AccountBalance } from '../domain/types';
import { colors, spacing, typography } from '../theme/tokens';
import { Card } from './ui';

type CompactAccountSelectorProps = {
  accounts: Account[];
  accountBalances?: AccountBalance[];
  selectedAccountIds: string[];
  title: string;
  emptyMessage?: string;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onToggleAccount: (accountId: string) => void;
  testID?: string;
};

const ACCOUNT_TILE_MIN_HEIGHT = 62;
const NEXT_ROW_PEEK_HEIGHT = 6;
const SCROLLABLE_ACCOUNT_LIST_HEIGHT =
  ACCOUNT_TILE_MIN_HEIGHT + spacing.sm + NEXT_ROW_PEEK_HEIGHT;

export function CompactAccountSelector({
  accounts,
  accountBalances = [],
  selectedAccountIds,
  title,
  emptyMessage = 'No accounts available.',
  onClearSelection,
  onSelectAll,
  onToggleAccount,
  testID,
}: CompactAccountSelectorProps) {
  const selectedAccountIdSet = new Set(selectedAccountIds);
  const allSelected = accounts.length > 0 && selectedAccountIds.length === accounts.length;
  const summary = getAccountSelectionSummary(accounts, selectedAccountIds);
  const listShouldScroll = accounts.length > 2;
  const balanceMinorByAccountId = new Map(
    accountBalances.map(({ account, balanceMinor }) => [account.id, balanceMinor]),
  );

  return (
    <Card testID={testID} style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          <Text numberOfLines={1} style={styles.detail}>{summary.detail}</Text>
        </View>
        <View style={styles.actions}>
          <SelectorAction disabled={allSelected} label="All" onPress={onSelectAll} />
          <SelectorAction disabled={!selectedAccountIds.length} label="None" onPress={onClearSelection} />
        </View>
      </View>

      {accounts.length ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={listShouldScroll}
          style={listShouldScroll ? styles.accountListScrollable : undefined}
          contentContainerStyle={styles.accountGrid}
        >
          {accounts.map((account) => (
                <AccountSelectorTile
                  key={account.id}
                  account={account}
                  balanceMinor={balanceMinorByAccountId.get(account.id)}
                  selected={selectedAccountIdSet.has(account.id)}
                  onPress={() => onToggleAccount(account.id)}
                />
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      )}
    </Card>
  );
}

function SelectorAction({
  disabled,
  label,
  onPress,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function AccountSelectorTile({
  account,
  balanceMinor,
  selected,
  onPress,
}: {
  account: Account;
  balanceMinor?: number;
  selected: boolean;
  onPress: () => void;
}) {
  const accountName = getAccountDisplayName(account);
  const balanceLabel = getAccountSelectionBalanceLabel(account, balanceMinor);

  return (
    <Pressable
      accessibilityLabel={`${accountName}, ${account.currencyCode}, ${selected ? 'selected' : 'not selected'}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: selected ? getTransparentColor(account.themeColor, '38') : colors.surface,
          borderColor: selected ? account.themeColor : getTransparentColor(account.themeColor, '99'),
          borderLeftColor: account.themeColor,
        },
        pressed && styles.pressed,
      ]}
      testID={`account-selector-${account.id}`}
    >
      <Text numberOfLines={1} style={styles.accountName}>
        {accountName}
      </Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.accountBalance}>
        {balanceLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  actions: {
    alignItems: 'center',
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  accountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: 1,
  },
  accountListScrollable: {
    height: SCROLLABLE_ACCOUNT_LIST_HEIGHT,
  },
  accountName: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '800',
    textAlign: 'right',
    width: '100%',
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  accountBalance: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
    width: '100%',
  },
  detail: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.78,
  },
  tile: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderLeftWidth: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: ACCOUNT_TILE_MIN_HEIGHT,
    width: '48%',
    minWidth: 130,
    padding: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
});
