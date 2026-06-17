import { useState } from 'react';
import { getRandomBytesAsync } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import {
  decryptRainproofBackup,
  encryptRainproofBackup,
  formatRecoveryKey,
  parseRecoveryKey,
  readRainproofContainerHeader,
  type BackupEncryptionKey,
} from '../../domain/backupContainer';
import {
  buildRainproofBackup,
  getRainproofBackupFilename,
  type RainproofBackup,
} from '../../domain/backupExport';
import type { AppSnapshot } from '../../domain/types';
import {
  getBackupEncryptionKey,
  getOrCreateBackupEncryptionKey,
  storeBackupEncryptionKey,
} from '../../application/backupKeyStore';

type UseBackupSettingsControllerInput = {
  snapshot: AppSnapshot;
  onRestoreBackup: (backup: RainproofBackup) => Promise<void>;
};

export function useBackupSettingsController({
  snapshot,
  onRestoreBackup,
}: UseBackupSettingsControllerInput) {
  const [backupError, setBackupError] = useState('');
  const [backupStatus, setBackupStatus] = useState('');
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [pendingBackupBytes, setPendingBackupBytes] = useState<Uint8Array | null>(null);
  const [pendingBackupName, setPendingBackupName] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [shownRecoveryKey, setShownRecoveryKey] = useState('');

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

  async function showRecoveryKey() {
    setBackupError('');
    try {
      setShownRecoveryKey(formatRecoveryKey(await getOrCreateBackupEncryptionKey()));
    } catch (error) {
      setBackupError(error instanceof Error ? error.message : 'Could not load the recovery key.');
    }
  }

  function confirmRestore(bytes: Uint8Array, key: BackupEncryptionKey) {
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

  async function performRestore(backup: RainproofBackup, key: BackupEncryptionKey) {
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

  return {
    backupError,
    backupStatus,
    chooseBackup,
    exportBackup,
    isBackupBusy,
    pendingBackupBytes,
    pendingBackupName,
    recoveryKey,
    restorePendingBackup,
    setRecoveryKey,
    showRecoveryKey,
    shownRecoveryKey,
  };
}
