import { useState } from 'react';
import { getRandomBytesAsync } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { CurrencyDropdown } from '../../components/CurrencyDropdown';
import { ActionButton, Card, FormError, SectionHeader } from '../../components/ui';
import {
  formatRecoveryKey,
  decryptRainproofBackup,
  encryptRainproofBackup,
  parseRecoveryKey,
  readRainproofContainerHeader,
} from '../../domain/backupContainer';
import {
  buildRainproofBackup,
  getRainproofBackupFilename,
  type RainproofBackup,
} from '../../domain/backupExport';
import { getActiveAccountCurrencyOptions } from '../../domain/currencyCatalog';
import type { AppSnapshot, CurrencyCode, UpdateAppSettingsInput } from '../../domain/types';
import {
  getBackupEncryptionKey,
  getOrCreateBackupEncryptionKey,
  storeBackupEncryptionKey,
} from '../../application/backupKeyStore';
import { colors, spacing, typography } from '../../theme/tokens';

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
  const [backupError, setBackupError] = useState('');
  const [backupStatus, setBackupStatus] = useState('');
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [pendingBackupBytes, setPendingBackupBytes] = useState<Uint8Array | null>(null);
  const [pendingBackupName, setPendingBackupName] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [shownRecoveryKey, setShownRecoveryKey] = useState('');
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

  async function exportBackup() {
    if (isBackupBusy) {
      return;
    }

    setBackupError('');
    setBackupStatus('');
    setIsBackupBusy(true);

    try {
      const exportedAt = new Date().toISOString();
      const key = await getOrCreateBackupEncryptionKey();
      const encrypted = encryptRainproofBackup(
        buildRainproofBackup(snapshot, exportedAt),
        key,
        await getRandomBytesAsync(24),
      );
      const backupFile = new File(Paths.cache, getRainproofBackupFilename(exportedAt));
      backupFile.create({
        intermediates: true,
        overwrite: true,
      });
      backupFile.write(encrypted);

      if (!(await Sharing.isAvailableAsync())) {
        setBackupError('File sharing is not available on this device.');
        return;
      }

      await Sharing.shareAsync(backupFile.uri, {
        dialogTitle: 'Export Rainproof backup',
        mimeType: 'application/octet-stream',
        UTI: 'public.data',
      });
      setBackupStatus('Encrypted backup export completed.');
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'Could not export the backup.');
    } finally {
      setIsBackupBusy(false);
    }
  }

  async function chooseBackup() {
    if (isBackupBusy) {
      return;
    }

    setBackupError('');
    setBackupStatus('');
    setPendingBackupBytes(null);
    setPendingBackupName('');
    setRecoveryKey('');
    setIsBackupBusy(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: '*/*',
      });
      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const bytes = await new File(asset.uri).bytes();
      const header = readRainproofContainerHeader(bytes);
      const localKey = await getBackupEncryptionKey();

      if (localKey?.id === header.keyId) {
        confirmRestore(bytes, localKey);
      } else {
        setPendingBackupBytes(bytes);
        setPendingBackupName(asset.name);
        setBackupError('Enter the recovery key for this backup to restore it.');
      }
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'Could not read the selected backup.');
    } finally {
      setIsBackupBusy(false);
    }
  }

  function restorePendingBackup() {
    if (!pendingBackupBytes) {
      return;
    }

    try {
      confirmRestore(pendingBackupBytes, parseRecoveryKey(recoveryKey));
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'The recovery key is invalid.');
    }
  }

  function confirmRestore(bytes: Uint8Array, key: ReturnType<typeof parseRecoveryKey>) {
    let backup: RainproofBackup;
    try {
      backup = decryptRainproofBackup(bytes, key);
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'Could not decrypt the selected backup.');
      return;
    }

    Alert.alert(
      'Restore Rainproof backup?',
      'This replaces all current Rainproof data on this device. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: () => {
            void performRestore(backup, key);
          },
        },
      ],
    );
  }

  async function performRestore(backup: RainproofBackup, key: ReturnType<typeof parseRecoveryKey>) {
    setBackupError('');
    setBackupStatus('');
    setIsBackupBusy(true);
    try {
      await onRestoreBackup(backup);
      await storeBackupEncryptionKey(key);
      setPendingBackupBytes(null);
      setPendingBackupName('');
      setRecoveryKey('');
      setBackupStatus('Backup restored.');
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'Could not restore the backup.');
    } finally {
      setIsBackupBusy(false);
    }
  }

  async function showRecoveryKey() {
    setBackupError('');
    try {
      setShownRecoveryKey(formatRecoveryKey(await getOrCreateBackupEncryptionKey()));
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'Could not load the recovery key.');
    }
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
        <Text style={styles.cardTitle}>Backup</Text>
        <Text style={styles.smallMuted}>
          Export an encrypted, compressed Rainproof backup. Keep your recovery key separately; Rainproof cannot
          recover it for you.
        </Text>
        <ActionButton
          disabled={isBackupBusy}
          onPress={() => void exportBackup()}
          testID="export-rainproof-backup"
          variant="secondary"
        >
          {isBackupBusy ? 'Working...' : 'Export encrypted backup'}
        </ActionButton>
        <ActionButton
          disabled={isBackupBusy}
          onPress={() => void chooseBackup()}
          testID="restore-rainproof-backup"
          variant="secondary"
        >
          Choose backup to restore
        </ActionButton>
        <ActionButton
          disabled={isBackupBusy}
          onPress={() => void showRecoveryKey()}
          testID="show-backup-recovery-key"
          variant="secondary"
        >
          Show recovery key
        </ActionButton>
        {shownRecoveryKey ? (
          <View style={styles.recoveryKeyPanel}>
            <Text style={styles.recoveryKeyLabel}>Recovery key</Text>
            <Text selectable style={styles.recoveryKeyValue}>{shownRecoveryKey}</Text>
          </View>
        ) : null}
        {pendingBackupBytes ? (
          <View style={styles.restoreStack}>
            <Text style={styles.settingTitle}>{pendingBackupName || 'Selected backup'}</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              onChangeText={setRecoveryKey}
              placeholder="Recovery key"
              placeholderTextColor={colors.muted}
              style={styles.recoveryKeyInput}
              value={recoveryKey}
            />
            <ActionButton
              disabled={isBackupBusy || !recoveryKey.trim()}
              onPress={restorePendingBackup}
              testID="confirm-backup-recovery-key"
            >
              Restore selected backup
            </ActionButton>
          </View>
        ) : null}
        <FormError message={backupError} />
        {backupStatus ? <Text style={styles.exportStatus}>{backupStatus}</Text> : null}
      </Card>

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
  recoveryKeyPanel: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  recoveryKeyLabel: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '800',
  },
  recoveryKeyValue: {
    color: colors.primaryDark,
    fontFamily: 'monospace',
    fontSize: typography.small,
    lineHeight: 20,
  },
  restoreStack: {
    gap: spacing.sm,
  },
  recoveryKeyInput: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: 'monospace',
    fontSize: typography.body,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
