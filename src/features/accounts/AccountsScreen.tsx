import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, {
  type RenderItemParams,
} from 'react-native-draggable-flatlist';

import { ActionButton, Card, SectionHeader } from '../../components/ui';
import type {
  Account,
  AccountBalance,
  AppSnapshot,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { AccountListRow } from './AccountListRow';

type AccountsScreenProps = {
  snapshot: AppSnapshot;
  accountBalances: AccountBalance[];
  onAddAccount: () => void;
  onEditAccount: (accountId: string) => void;
  onUpdateAccountDashboardVisibility: (accountId: string, showOnDashboard: boolean) => Promise<void>;
  onUpdateAccountOrder: (accountIds: string[]) => Promise<void>;
};

export function AccountsScreen({
  snapshot,
  accountBalances,
  onAddAccount,
  onEditAccount,
  onUpdateAccountDashboardVisibility,
  onUpdateAccountOrder,
}: AccountsScreenProps) {
  const [dashboardEditMode, setDashboardEditMode] = useState(false);
  const balanceByAccountId = useMemo(
    () => new Map(accountBalances.map((balance) => [balance.account.id, balance.balanceMinor])),
    [accountBalances],
  );
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;

  function renderAccountRow({ item, drag, isActive }: RenderItemParams<Account>) {
    return (
      <AccountListRow
        account={item}
        balanceMinor={balanceByAccountId.get(item.id)}
        dashboardEditMode={dashboardEditMode}
        dragging={isActive}
        showCurrencyCodes={showCurrencyCodes}
        onDrag={drag}
        onPress={() => {
          if (dashboardEditMode) {
            if (!item.isArchived) {
              void onUpdateAccountDashboardVisibility(item.id, !item.showOnDashboard);
            }
            return;
          }

          onEditAccount(item.id);
        }}
      />
    );
  }

  return (
    <View style={styles.stack}>
      <SectionHeader title="Accounts" detail="Drag to reorder. Use edit mode to choose Dashboard accounts." />

      <Card testID="accounts-list-card" style={styles.listCard}>
        <View style={styles.headerRow}>
          <Text style={styles.cardTitle}>Your accounts</Text>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel={dashboardEditMode ? 'Finish editing Dashboard accounts' : 'Edit Dashboard accounts'}
              accessibilityRole="button"
              onPress={() => setDashboardEditMode((value) => !value)}
              style={({ pressed }) => [
                styles.iconButton,
                dashboardEditMode && styles.iconButtonSelected,
                pressed && styles.pressed,
              ]}
              testID="accounts-toggle-dashboard-edit"
            >
              <Ionicons
                name={dashboardEditMode ? 'eye-off-outline' : 'eye-outline'}
                size={21}
                color={dashboardEditMode ? colors.primaryDark : colors.muted}
              />
            </Pressable>
            <Pressable
              accessibilityLabel="Add account"
              accessibilityRole="button"
              onPress={onAddAccount}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              testID="accounts-add-account"
            >
              <Ionicons name="add" size={22} color={colors.primaryDark} />
            </Pressable>
          </View>
        </View>

        {dashboardEditMode ? (
          <View style={styles.modeHint}>
            <Ionicons name="grid-outline" size={15} color={colors.primaryDark} />
            <Text style={styles.modeHintText}>Tap active accounts to show or hide them on Dashboard.</Text>
          </View>
        ) : null}

        {snapshot.accounts.length ? (
          <DraggableFlatList
            data={snapshot.accounts}
            keyExtractor={(account) => account.id}
            onDragEnd={({ data }) => {
              void onUpdateAccountOrder(data.map((account) => account.id));
            }}
            renderItem={renderAccountRow}
            activationDistance={8}
            containerStyle={styles.draggableList}
            contentContainerStyle={styles.accountRows}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="wallet-outline" size={28} color={colors.primaryDark} />
            <Text style={styles.emptyTitle}>No accounts yet</Text>
            <ActionButton onPress={onAddAccount}>Add account</ActionButton>
          </View>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    flex: 1,
    gap: spacing.md,
  },
  listCard: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cardTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  iconButton: {
    alignItems: 'center',
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconButtonSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  modeHint: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  modeHintText: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '800',
  },
  draggableList: {
    flex: 1,
  },
  accountRows: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
