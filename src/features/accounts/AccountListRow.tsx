import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import { AccountIconBadge } from '../../components/AccountDisplay';
import { getAccountDisplayName, getTransparentColor } from '../../domain/accountThemes';
import {
  formatCreditCardBalanceLabel,
  formatCreditCardUtilization,
  getCreditCardBalanceSummary,
} from '../../domain/creditCards';
import { formatMoney } from '../../domain/money';
import type { Account } from '../../domain/types';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';

type AccountListRowProps = {
  account: Account;
  balanceMinor: number | undefined;
  dashboardEditMode: boolean;
  dragging: boolean;
  showCurrencyCodes: boolean;
  onDrag: () => void;
  onPress: () => void;
};

export function AccountListRow({
  account,
  balanceMinor,
  dashboardEditMode,
  dragging,
  showCurrencyCodes,
  onDrag,
  onPress,
}: AccountListRowProps) {
  const hiddenFromDashboard = account.isArchived || !account.showOnDashboard;
  const accountBalance = { account, balanceMinor: balanceMinor ?? 0 };
  const creditCardSummary = balanceMinor === undefined ? null : getCreditCardBalanceSummary(accountBalance);
  const balanceLabel =
    account.isArchived || balanceMinor === undefined
      ? 'Closed'
      : creditCardSummary
        ? formatCreditCardBalanceLabel(accountBalance, { showCurrencyCode: showCurrencyCodes })
        : formatMoney(balanceMinor, account.currencyCode, { showCurrencyCode: showCurrencyCodes });
  const detailText = creditCardSummary?.availableCreditMinor !== null && creditCardSummary?.availableCreditMinor !== undefined
    ? getCreditCardLimitDetail(creditCardSummary, showCurrencyCodes)
    : account.notes || 'No notes yet.';

  return (
    <ScaleDecorator>
      <View
        style={[
          styles.accountRow,
          {
            backgroundColor: getTransparentColor(account.themeColor, account.isArchived ? '10' : '22'),
            borderColor: account.themeColor,
          },
          account.isArchived && styles.archivedRow,
          dragging && sharedStyles.draggingSurface,
          dashboardEditMode && !hiddenFromDashboard && styles.dashboardVisibleRow,
        ]}
      >
        <Pressable
          accessibilityLabel={`Reorder ${getAccountDisplayName(account)}`}
          accessibilityRole="button"
          onLongPress={onDrag}
          style={({ pressed }) => [styles.dragHandle, pressed && sharedStyles.pressed]}
          testID={`account-drag-${account.id}`}
        >
          <Ionicons name="reorder-three-outline" size={24} color={colors.primaryDark} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.accountButton, pressed && sharedStyles.pressed]}
          testID={`account-row-${account.id}`}
        >
          <AccountIconBadge account={account} size="md" />
          <View style={styles.accountMain}>
            <View style={styles.accountTitleRow}>
              {account.includeInRainyDay ? (
                <Ionicons name="umbrella-outline" size={17} color={colors.primaryDark} />
              ) : null}
              <Text numberOfLines={1} style={styles.accountName}>
                {getAccountDisplayName(account)}
              </Text>
              {hiddenFromDashboard ? (
                <Ionicons name="eye-off-outline" size={16} color={colors.muted} />
              ) : null}
              {account.isArchived ? <Text style={styles.closedBadge}>Closed</Text> : null}
            </View>
            <Text numberOfLines={1} style={styles.notesText}>
              {detailText}
            </Text>
          </View>
          <Text style={[styles.balanceText, account.isArchived && styles.closedBalanceText]}>{balanceLabel}</Text>
        </Pressable>
      </View>
    </ScaleDecorator>
  );
}

const styles = StyleSheet.create({
  accountRow: {
    alignItems: 'center',
    borderLeftWidth: 5,
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.xs,
    height: 84,
    padding: spacing.xs,
  },
  archivedRow: {
    opacity: 0.58,
  },
  dashboardVisibleRow: {
    borderRightColor: colors.primary,
    borderRightWidth: 3,
  },
  dragHandle: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    width: 34,
  },
  accountButton: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    height: '100%',
    minWidth: 0,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
  },
  accountMain: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  accountTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  accountName: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: typography.body,
    fontWeight: '900',
  },
  closedBadge: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: typography.small,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  notesText: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 17,
  },
  balanceText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  closedBalanceText: {
    color: colors.muted,
  },
});

function getCreditCardLimitDetail(
  summary: NonNullable<ReturnType<typeof getCreditCardBalanceSummary>>,
  showCurrencyCodes: boolean,
): string {
  const utilization = formatCreditCardUtilization(summary.utilization);
  const formattedAvailable = formatMoney(
    Math.abs(summary.availableCreditMinor ?? 0),
    summary.account.currencyCode,
    { showCurrencyCode: showCurrencyCodes },
  );

  if ((summary.availableCreditMinor ?? 0) < 0) {
    return `Over limit by ${formattedAvailable}${utilization ? ` - ${utilization} used` : ''}`;
  }

  return `Available ${formattedAvailable}${utilization ? ` - ${utilization} used` : ''}`;
}
