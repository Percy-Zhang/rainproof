import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { CurrencyDropdown } from '../../components/CurrencyDropdown';
import { ActionButton, Card, SectionHeader } from '../../components/ui';
import type { RainproofBackup } from '../../domain/backupExport';
import { getActiveAccountCurrencyOptions } from '../../domain/currencyCatalog';
import type { AppSnapshot, CurrencyCode, UpdateAppSettingsInput } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { BackupSettingsFlow } from './BackupSettingsFlow';
import { useBackupSettingsController } from './useBackupSettingsController';

type SettingsScreenProps = {
  snapshot: AppSnapshot;
  onOpenCategoryManagement: () => void;
  onRestoreBackup: (backup: RainproofBackup) => Promise<void>;
  onUpdateSettings: (input: UpdateAppSettingsInput) => Promise<void>;
  showHeader?: boolean;
};

export function SettingsScreen({
  snapshot,
  onOpenCategoryManagement,
  onRestoreBackup,
  onUpdateSettings,
  showHeader = true,
}: SettingsScreenProps) {
  const backup = useBackupSettingsController({ snapshot, onRestoreBackup });
  const defaultCurrencyOptions = getActiveAccountCurrencyOptions(
    snapshot.accounts,
    snapshot.settings.defaultCurrencyCode,
  );

  function updateDefaultCurrency(defaultCurrencyCode: CurrencyCode) {
    void onUpdateSettings({
      defaultCurrencyCode,
      multiCurrencyEnabled: snapshot.settings.multiCurrencyEnabled,
      enabledCurrencyCodes: snapshot.settings.enabledCurrencyCodes,
    });
  }

  return (
    <View style={styles.stack}>
      {showHeader ? (
        <SectionHeader title="Settings" detail="App defaults, currency behavior, and categories." />
      ) : null}

      <Card testID="currency-settings-card">
        <Text style={styles.cardTitle}>Currency</Text>
        <CurrencyDropdown
          label="Default currency"
          value={snapshot.settings.defaultCurrencyCode}
          options={defaultCurrencyOptions}
          onChange={updateDefaultCurrency}
          testID="default-currency-dropdown"
        />
        <Text style={styles.smallMuted}>
          Used as the default for new accounts. Existing account, transaction, and budget currencies are unchanged;
          Rainproof does not convert amounts.
        </Text>

        <View style={styles.settingRow}>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Currency display</Text>
            <Text style={styles.smallMuted}>
              Rainproof automatically shows currency codes when accounts use more than one currency.
            </Text>
          </View>
          <Text style={styles.currencyBadge}>
            {snapshot.settings.multiCurrencyEnabled ? 'Multiple' : 'Single'}
          </Text>
        </View>

      </Card>

      <Card testID="category-settings-card">
        <Text style={styles.cardTitle}>Categories</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onOpenCategoryManagement}
          style={({ pressed }) => [styles.settingsNavRow, pressed && styles.pressed]}
        >
          <CategoryIconBadge color={colors.primary} icon="pricetags-outline" size="md" />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Edit categories</Text>
            <Text style={styles.smallMuted}>Names, colors, icons, and subcategories.</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Card>

      <Card testID="backup-settings-card">
        <Text style={styles.cardTitle}>Backup & restore</Text>
        <Text style={styles.smallMuted}>
          Export a backup of your Rainproof data or restore from an existing .rainproof file.
        </Text>
        <ActionButton
          disabled={backup.isBackupBusy}
          onPress={backup.openExportFlow}
          testID="export-rainproof-backup"
          variant="secondary"
        >
          Export backup
        </ActionButton>
        <ActionButton
          disabled={backup.isBackupBusy}
          onPress={backup.openRestoreFlow}
          testID="restore-rainproof-backup"
          variant="secondary"
        >
          Restore backup
        </ActionButton>
        {backup.backupStatus ? (
          <Text accessibilityLiveRegion="polite" style={styles.exportStatus}>{backup.backupStatus}</Text>
        ) : null}
      </Card>

      <BackupSettingsFlow controller={backup} />

      <Text style={styles.note}>
        Currency conversion and exchange rates are not active yet. Until then, balances remain separated internally by
        currency.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
  settingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  settingsNavRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  settingText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  settingTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
  },
  smallMuted: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  currencyBadge: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
  },
  exportStatus: {
    color: colors.success,
    fontSize: typography.small,
    fontWeight: '700',
  },
  note: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
    paddingBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.78,
  },
  chevron: {
    color: colors.muted,
    fontSize: 24,
    fontWeight: '700',
  },
});
