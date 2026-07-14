import { getRandomBytesAsync } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type SelectedBackupFile = {
  name: string;
  uri: string;
};

export type BackupSettingsServices = {
  getRandomBytes: (length: number) => Promise<Uint8Array>;
  pickBackupFile: () => Promise<SelectedBackupFile | null>;
  readBackupFile: (uri: string) => Promise<Uint8Array>;
  writeBackupFile: (filename: string, bytes: Uint8Array) => Promise<string>;
  shareBackupFile: (uri: string) => Promise<void>;
};

export const defaultBackupSettingsServices: BackupSettingsServices = {
  getRandomBytes: getRandomBytesAsync,
  async pickBackupFile() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    });
    if (result.canceled || !result.assets[0]) {
      return null;
    }
    return {
      name: result.assets[0].name,
      uri: result.assets[0].uri,
    };
  },
  async readBackupFile(uri) {
    return new File(uri).bytes();
  },
  async writeBackupFile(filename, bytes) {
    const backupFile = new File(Paths.cache, filename);
    backupFile.create({
      intermediates: true,
      overwrite: true,
    });
    backupFile.write(bytes);
    return backupFile.uri;
  },
  async shareBackupFile(uri) {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('File sharing is unavailable.');
    }

    await Sharing.shareAsync(uri, {
      dialogTitle: 'Export Rainproof backup',
      mimeType: 'application/octet-stream',
      UTI: 'public.data',
    });
  },
};
