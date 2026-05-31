import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

type DashboardQuickActionsProps = {
  onAddTransaction: (params?: { dashboardAccountIds?: string[] }) => void;
  onOpenTemplates: () => void;
  selectedAccountIds: string[];
};

export function DashboardQuickActions({
  onAddTransaction,
  onOpenTemplates,
  selectedAccountIds,
}: DashboardQuickActionsProps) {
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  useEffect(() => {
    if (!quickActionsOpen) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setQuickActionsOpen(false);
      return true;
    });

    return () => subscription.remove();
  }, [quickActionsOpen]);

  function openAddTransaction() {
    setQuickActionsOpen(false);
    onAddTransaction({ dashboardAccountIds: selectedAccountIds });
  }

  function openTemplates() {
    setQuickActionsOpen(false);
    onOpenTemplates();
  }

  return (
    <>
      {quickActionsOpen ? (
        <Pressable
          accessibilityLabel="Close dashboard quick actions"
          accessibilityRole="button"
          onPress={() => setQuickActionsOpen(false)}
          style={styles.quickActionBackdrop}
          testID="dashboard-quick-action-backdrop"
        />
      ) : null}
      {quickActionsOpen ? (
        <View pointerEvents="box-none" style={styles.quickActionMenu} testID="dashboard-quick-action-menu">
          <DashboardQuickAction
            accessibilityLabel="Use Template"
            icon="flash-outline"
            label="Use Template"
            onPress={openTemplates}
            testID="dashboard-quick-action-use-template"
          />
          <DashboardQuickAction
            accessibilityLabel="Add Transaction"
            icon="receipt-outline"
            label="Add Transaction"
            onPress={openAddTransaction}
            testID="dashboard-quick-action-add-transaction"
          />
        </View>
      ) : null}
      <Pressable
        accessibilityLabel={quickActionsOpen ? 'Close dashboard quick actions' : 'Open dashboard quick actions'}
        accessibilityHint="Shows actions for adding a transaction or using a template."
        accessibilityRole="button"
        onPress={() => setQuickActionsOpen((current) => !current)}
        style={({ pressed }) => [styles.floatingAddButton, pressed && styles.pressedRow]}
        testID="dashboard-add-transaction"
      >
        <Ionicons name={quickActionsOpen ? 'close' : 'add'} size={30} color={colors.surface} />
      </Pressable>
    </>
  );
}

function DashboardQuickAction({
  accessibilityLabel,
  icon,
  label,
  onPress,
  testID,
}: {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickActionRow, pressed && styles.pressedRow]}
      testID={testID}
    >
      <View style={styles.quickActionLabelPill}>
        <Text style={styles.quickActionLabel}>{label}</Text>
      </View>
      <View style={styles.quickActionIconButton}>
        <Ionicons name={icon} size={20} color={colors.surface} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  floatingAddButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    bottom: spacing.xl,
    elevation: 7,
    height: 58,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: 58,
    zIndex: 20,
  },
  pressedRow: {
    opacity: 0.78,
  },
  quickActionBackdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 18,
  },
  quickActionIconButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    elevation: 5,
    height: 44,
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    width: 44,
  },
  quickActionLabel: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  quickActionLabelPill: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  quickActionMenu: {
    alignItems: 'flex-end',
    bottom: spacing.xl + 68,
    gap: spacing.sm,
    position: 'absolute',
    right: spacing.lg + 7,
    zIndex: 22,
  },
  quickActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    minHeight: 48,
  },
});
