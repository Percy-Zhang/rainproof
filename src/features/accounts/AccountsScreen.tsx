import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, SectionHeader } from '../../components/ui';
import type {
  Account,
  AccountBalance,
  AppSnapshot,
} from '../../domain/types';
import {
  haveIdsInSameOrder,
  mergeIdsByPreferredOrder,
  orderItemsById,
  orderItemsByIdOrFallback,
} from '../../domain/reorder';
import { colors, spacing, typography } from '../../theme/tokens';
import { useDeferredOrderPersistence } from '../useDeferredOrderPersistence';
import { AccountsReorderList } from './AccountsReorderList';

type AccountsScreenProps = {
  snapshot: AppSnapshot;
  accountBalances: AccountBalance[];
  onAddAccount: () => void;
  onEditAccount: (accountId: string) => void;
  onUpdateAccountDashboardVisibility: (accountId: string, showOnDashboard: boolean) => Promise<void>;
  onUpdateAccountOrder: (accountIds: string[]) => Promise<void>;
  showHeader?: boolean;
};

export function AccountsScreen({
  snapshot,
  accountBalances,
  onAddAccount,
  onEditAccount,
  onUpdateAccountDashboardVisibility,
  onUpdateAccountOrder,
  showHeader = true,
}: AccountsScreenProps) {
  const [dashboardEditMode, setDashboardEditMode] = useState(false);
  const balanceByAccountId = useMemo(
    () => new Map(accountBalances.map((balance) => [balance.account.id, balance.balanceMinor])),
    [accountBalances],
  );
  const snapshotAccountIds = useMemo(
    () => snapshot.accounts.map((account) => account.id),
    [snapshot.accounts],
  );
  const pendingAccountOrderIdsRef = useRef<string[] | null>(null);
  const accountDragActiveRef = useRef(false);
  const accountDropSettlingRef = useRef(false);
  const accountDragStartIdsRef = useRef<string[] | null>(null);
  const visualAccountIdsRef = useRef(snapshotAccountIds);
  const latestSnapshotAccountsRef = useRef(snapshot.accounts);
  const latestSnapshotAccountIdsRef = useRef(snapshotAccountIds);
  const [accounts, setAccounts] = useState(() => snapshot.accounts);
  const showCurrencyCodes = snapshot.settings.multiCurrencyEnabled;
  const scheduleAccountOrderPersistence = useDeferredOrderPersistence(onUpdateAccountOrder);

  const syncAccountsFromSnapshot = useCallback((
    nextSnapshotAccounts = latestSnapshotAccountsRef.current,
    nextSnapshotIds = latestSnapshotAccountIdsRef.current,
  ) => {
    setAccounts((currentRows) => {
      const pendingIds = pendingAccountOrderIdsRef.current;
      const currentIds = currentRows.map((account) => account.id);
      if (!pendingIds) {
        visualAccountIdsRef.current = nextSnapshotIds;
        return nextSnapshotAccounts;
      }

      const mergedIds = mergeIdsByPreferredOrder(nextSnapshotIds, pendingIds);
      if (haveIdsInSameOrder(nextSnapshotIds, mergedIds)) {
        pendingAccountOrderIdsRef.current = null;
        visualAccountIdsRef.current = nextSnapshotIds;
        if (haveIdsInSameOrder(currentIds, nextSnapshotIds)) {
          return currentRows;
        }

        return nextSnapshotAccounts;
      }

      const nextAccounts = orderItemsById(nextSnapshotAccounts, mergedIds);
      visualAccountIdsRef.current = nextAccounts.map((account) => account.id);
      pendingAccountOrderIdsRef.current = mergedIds;
      return nextAccounts;
    });
  }, []);

  useEffect(() => {
    latestSnapshotAccountsRef.current = snapshot.accounts;
    latestSnapshotAccountIdsRef.current = snapshotAccountIds;

    if (accountDragActiveRef.current || accountDropSettlingRef.current) {
      return;
    }

    syncAccountsFromSnapshot(snapshot.accounts, snapshotAccountIds);
  }, [snapshot.accounts, snapshotAccountIds, syncAccountsFromSnapshot]);

  const handleDragBegin = useCallback(() => {
    accountDragActiveRef.current = true;
    accountDropSettlingRef.current = true;
    accountDragStartIdsRef.current = visualAccountIdsRef.current;
  }, []);

  const handleDragEnd = useCallback((nextIds: string[]) => {
    const dragStartIds = accountDragStartIdsRef.current ?? visualAccountIdsRef.current;
    accountDragActiveRef.current = false;
    accountDragStartIdsRef.current = null;

    if (haveIdsInSameOrder(dragStartIds, nextIds)) {
      accountDropSettlingRef.current = false;
      syncAccountsFromSnapshot();
      return;
    }

    pendingAccountOrderIdsRef.current = nextIds;
    visualAccountIdsRef.current = nextIds;
    setAccounts((currentAccounts) => orderItemsByIdOrFallback(currentAccounts, nextIds, currentAccounts));
    accountDropSettlingRef.current = false;
    scheduleAccountOrderPersistence(nextIds);
  }, [scheduleAccountOrderPersistence, syncAccountsFromSnapshot]);

  const handleAccountPress = useCallback((account: Account) => {
    if (dashboardEditMode) {
      if (!account.isArchived) {
        void onUpdateAccountDashboardVisibility(account.id, !account.showOnDashboard);
      }
      return;
    }

    onEditAccount(account.id);
  }, [dashboardEditMode, onEditAccount, onUpdateAccountDashboardVisibility]);

  return (
    <View style={styles.stack}>
      {showHeader ? (
        <SectionHeader title="Accounts" detail="Drag to reorder. Use edit mode to choose Dashboard accounts." />
      ) : null}

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

        {accounts.length ? (
          <AccountsReorderList
            accounts={accounts}
            balanceByAccountId={balanceByAccountId}
            dashboardEditMode={dashboardEditMode}
            showCurrencyCodes={showCurrencyCodes}
            onDragBegin={handleDragBegin}
            onDragEnd={handleDragEnd}
            onPressAccount={handleAccountPress}
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
