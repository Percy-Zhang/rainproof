import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScaleDecorator } from 'react-native-draggable-flatlist';

import { AccountIconBadge } from '../../components/AccountDisplay';
import { getAccountDisplayName, getTransparentColor } from '../../domain/accountThemes';
import { formatMoney } from '../../domain/money';
import type { Account } from '../../domain/types';
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
  const balanceLabel =
    account.isArchived || balanceMinor === undefined
      ? 'Closed'
      : formatMoney(balanceMinor, account.currencyCode, { showCurrencyCode: showCurrencyCodes });

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
          dragging && styles.draggingRow,
          dashboardEditMode && !hiddenFromDashboard && styles.dashboardVisibleRow,
        ]}
      >
        <Pressable
          accessibilityLabel={`Reorder ${getAccountDisplayName(account)}`}
          accessibilityRole="button"
          onLongPress={onDrag}
          style={({ pressed }) => [styles.dragHandle, pressed && styles.pressed]}
          testID={`account-drag-${account.id}`}
        >
          <Ionicons name="reorder-three-outline" size={24} color={colors.primaryDark} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.accountButton, pressed && styles.pressed]}
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
              {account.notes || 'No notes yet.'}
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
  draggingRow: {
    elevation: 8,
    opacity: 0.95,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
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
  pressed: {
    opacity: 0.78,
  },
});
