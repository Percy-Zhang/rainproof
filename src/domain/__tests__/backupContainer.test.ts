import {
  decryptRainproofBackup,
  encryptRainproofBackup,
  formatRecoveryKey,
  parseRecoveryKey,
  readRainproofContainerHeader,
  type BackupEncryptionKey,
} from '../backupContainer';
import { buildRainproofBackup } from '../backupExport';
import type { AppSnapshot } from '../types';

const exportedAt = '2026-06-10T08:30:00.000Z';
const key: BackupEncryptionKey = {
  id: '00112233445566778899aabbccddeeff',
  bytes: Uint8Array.from({ length: 32 }, (_, index) => index),
};
const nonce = Uint8Array.from({ length: 24 }, (_, index) => 24 - index);

describe('encrypted Rainproof backup container', () => {
  it('compresses, encrypts, authenticates, and decrypts the internal backup payload', () => {
    const backup = buildRainproofBackup(createMinimalSnapshot(), exportedAt);
    const container = encryptRainproofBackup(backup, key, nonce);

    expect(readRainproofContainerHeader(container)).toMatchObject({
      containerVersion: 1,
      exportedAt,
      keyId: key.id,
      cipher: 'xchacha20-poly1305',
      compression: 'gzip',
    });
    expect(decryptRainproofBackup(container, key)).toEqual(backup);
    expect(new TextDecoder().decode(container)).not.toContain('Everyday');
  });

  it('rejects a wrong key and tampered ciphertext', () => {
    const container = encryptRainproofBackup(buildRainproofBackup(createMinimalSnapshot(), exportedAt), key, nonce);
    const wrongKey = { ...key, bytes: new Uint8Array(32).fill(9) };
    const tampered = container.slice();
    tampered[tampered.length - 1] ^= 1;

    expect(() => decryptRainproofBackup(container, wrongKey)).toThrow('could not be decrypted');
    expect(() => decryptRainproofBackup(tampered, key)).toThrow('could not be decrypted');
  });

  it('formats and parses a portable recovery key without changing key material', () => {
    expect(parseRecoveryKey(formatRecoveryKey(key))).toEqual(key);
  });
});

function createMinimalSnapshot(): AppSnapshot {
  const now = '2026-06-01T00:00:00.000Z';
  return {
    defaultCurrencyCode: 'AUD',
    settings: {
      defaultCurrencyCode: 'AUD',
      defaultCurrencyMode: 'manual',
      multiCurrencyEnabled: false,
      enabledCurrencyCodes: ['AUD'],
      dashboardSelectedAccountIds: null,
    },
    categories: [],
    accounts: [{
      id: 'account-1',
      name: 'Everyday',
      nickname: '',
      type: 'checking',
      currencyCode: 'AUD',
      openingBalanceMinor: 100,
      creditLimitMinor: null,
      notes: '',
      institutionName: '',
      includeInRainyDay: false,
      themeColor: '#1876A8',
      iconName: 'wallet-outline',
      showOnDashboard: true,
      sortOrder: 0,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }],
    transactions: [],
    transactionLines: [],
    transactionLinks: [],
    budgets: [],
    recurringItems: [],
    recurringBills: [],
    recurringTransactionHistory: [],
    transactionTemplates: [],
    rainyDayFund: {
      id: 'fund-1',
      name: 'Rainy day fund',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}
