import { getRandomBytesAsync, randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';

import type { BackupEncryptionKey } from '../domain/backupContainer';

const BACKUP_KEY_STORAGE_KEY = 'rainproof.backup-key.v1';

type StoredBackupKey = {
  id: string;
  keyHex: string;
};

export async function getOrCreateBackupEncryptionKey(): Promise<BackupEncryptionKey> {
  const stored = await SecureStore.getItemAsync(BACKUP_KEY_STORAGE_KEY);
  if (stored) {
    return parseStoredKey(stored);
  }

  const key: BackupEncryptionKey = {
    id: randomUUID().replace(/-/g, ''),
    bytes: await getRandomBytesAsync(32),
  };
  await storeBackupEncryptionKey(key);
  return key;
}

export async function getBackupEncryptionKey(): Promise<BackupEncryptionKey | null> {
  const stored = await SecureStore.getItemAsync(BACKUP_KEY_STORAGE_KEY);
  return stored ? parseStoredKey(stored) : null;
}

export async function storeBackupEncryptionKey(key: BackupEncryptionKey): Promise<void> {
  const value: StoredBackupKey = {
    id: key.id,
    keyHex: bytesToHex(key.bytes),
  };
  await SecureStore.setItemAsync(BACKUP_KEY_STORAGE_KEY, JSON.stringify(value), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

function parseStoredKey(value: string): BackupEncryptionKey {
  try {
    const parsed = JSON.parse(value) as StoredBackupKey;
    const bytes = hexToBytes(parsed.keyHex);
    if (!parsed.id || bytes.length !== 32) {
      throw new Error();
    }
    return { id: parsed.id, bytes };
  } catch {
    throw new Error('The stored Rainproof backup key is invalid.');
  }
}
