import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';

import {
  BackupReadError,
  createRainproofBackupContainer,
  createRainproofBackupContainerFromSnapshot,
  inspectRainproofBackup,
  RAINPROOF_CONTAINER_FORMAT,
  RAINPROOF_PASSWORD_KDF_ITERATIONS,
  validateRainproofBackup,
  type BackupContainerObserver,
  type BackupContainerStage,
  type BackupStageTiming,
  type RainproofBackupRandomness,
} from '../backupContainer';
import { buildRainproofBackup } from '../backupExport';
import type { AppSnapshot } from '../types';
import { APP_VERSION } from '../versioning';

const exportedAt = '2026-06-10T08:30:00.000Z';
const firstRandomness = createRandomness(1, 31);
const secondRandomness = createRandomness(51, 81);

describe('Rainproof backup container', () => {
  it('creates a password-protected authenticated backup and exposes only safe header metadata', async () => {
    const password = 'correct horse battery staple';
    const snapshot = createMinimalSnapshot();
    const backup = buildRainproofBackup(snapshot, exportedAt);
    const exportStages: BackupContainerStage[] = [];
    const exportTimings: BackupStageTiming[] = [];
    const container = await createRainproofBackupContainerFromSnapshot(
      snapshot,
      exportedAt,
      password,
      firstRandomness,
      collectStages(exportStages, exportTimings),
    );
    const inspection = inspectRainproofBackup(container);

    expect(inspection).toEqual({
      createdAt: exportedAt,
      appVersion: APP_VERSION,
      formatVersion: 1,
      backupFormatVersion: 1,
      protectionMode: 'password',
    });
    expect(inspection).not.toHaveProperty('counts');
    expect(readRawHeader(container).format).toBe(RAINPROOF_CONTAINER_FORMAT);
    expect(new TextDecoder().decode(container)).not.toContain(password);
    expect(new TextDecoder().decode(container)).not.toContain('Everyday');
    expect(RAINPROOF_PASSWORD_KDF_ITERATIONS).toBe(1000);
    expect(exportStages).toEqual([
      'build-snapshot',
      'validate-payload',
      'serialize',
      'encode',
      'compress',
      'build-header',
      'derive-key',
      'encrypt',
      'build-container',
    ]);
    expect(exportTimings.find((timing) => timing.stage === 'compress')).toMatchObject({
      operation: 'export',
      status: 'success',
      inputBytes: expect.any(Number),
      outputBytes: expect.any(Number),
    });

    const validationStages: BackupContainerStage[] = [];
    await expect(validateRainproofBackup(
      container,
      password,
      collectStages(validationStages),
    )).resolves.toEqual(backup);
    expect(validationStages).toEqual([
      'parse-container',
      'derive-key',
      'decrypt',
      'decompress',
      'decode',
      'parse-payload',
      'validate-payload',
    ]);
  });

  it('rejects a missing or wrong password and modified ciphertext', async () => {
    const container = await createRainproofBackupContainer(
      buildRainproofBackup(createMinimalSnapshot(), exportedAt),
      'password',
      firstRandomness,
    );
    const tampered = container.slice();
    tampered[tampered.length - 1] ^= 1;

    await expect(validateRainproofBackup(container)).rejects.toMatchObject({
      code: 'password_required',
    });
    await expect(validateRainproofBackup(container, 'wrong')).rejects.toMatchObject({
      code: 'incorrect_password_or_corrupt_backup',
    });
    await expect(validateRainproofBackup(tampered, 'password')).rejects.toMatchObject({
      code: 'incorrect_password_or_corrupt_backup',
    });
  });

  it('uses fresh salt and nonce so identical protected exports differ', async () => {
    const backup = buildRainproofBackup(createMinimalSnapshot(), exportedAt);
    const first = await createRainproofBackupContainer(backup, 'password', firstRandomness);
    const second = await createRainproofBackupContainer(backup, 'password', secondRandomness);
    const firstHeader = readRawHeader(first);
    const secondHeader = readRawHeader(second);

    expect(first).not.toEqual(second);
    expect(firstHeader.protection.kdf.saltHex).not.toBe(secondHeader.protection.kdf.saltHex);
    expect(firstHeader.protection.cipher.nonceHex).not.toBe(secondHeader.protection.cipher.nonceHex);
    expect(firstHeader.protection.kdf.iterations).toBe(RAINPROOF_PASSWORD_KDF_ITERATIONS);
    expect(firstHeader).not.toHaveProperty('password');
    expect(firstHeader).not.toHaveProperty('key');
  });

  it.each([
    '   ',
    ' a long passphrase with spaces at both ends ',
    'café déjà vu',
    'မိုးရွာဖြို့',
    '🌧️💰🔐',
    'Rain မိုး 🌧️ pass',
  ])('preserves the exact UTF-8 password %p', async (password) => {
    const backup = buildRainproofBackup(createMinimalSnapshot(), exportedAt);
    const container = await createRainproofBackupContainer(backup, password, firstRandomness);

    expect(inspectRainproofBackup(container).protectionMode).toBe('password');
    await expect(validateRainproofBackup(container, password)).resolves.toEqual(backup);
    const changedPassword = password.startsWith(' ') ? password.trim() : `${password} `;
    await expect(validateRainproofBackup(container, changedPassword)).rejects.toBeInstanceOf(BackupReadError);
  });

  it('creates an honestly unencrypted backup when the password is exactly blank', async () => {
    const backup = buildRainproofBackup(createMinimalSnapshot(), exportedAt);
    const stages: BackupContainerStage[] = [];
    const container = await createRainproofBackupContainer(
      backup,
      '',
      undefined,
      collectStages(stages),
    );

    expect(inspectRainproofBackup(container).protectionMode).toBe('none');
    expect(readRawHeader(container).protection).toMatchObject({
      mode: 'none',
      checksum: { algorithm: 'sha256' },
    });
    expect(stages).toContain('checksum');
    expect(stages).not.toContain('derive-key');
    expect(stages).not.toContain('encrypt');
    await expect(validateRainproofBackup(container)).resolves.toEqual(backup);
  });

  it('detects corruption in an unencrypted backup before payload validation', async () => {
    const container = await createRainproofBackupContainer(
      buildRainproofBackup(createMinimalSnapshot(), exportedAt),
      '',
    );
    const tampered = container.slice();
    tampered[tampered.length - 1] ^= 1;

    await expect(validateRainproofBackup(tampered)).rejects.toMatchObject({ code: 'invalid_backup' });
  });

  it.each([
    ['wrong format identifier', (header: any) => { header.format = 'not-rainproof'; }],
    ['unsupported format version', (header: any) => { header.version = 99; }],
    ['unsupported protection mode', (header: any) => { header.protection.mode = 'recovery-key'; }],
    ['missing salt', (header: any) => { delete header.protection.kdf.saltHex; }],
    ['invalid nonce', (header: any) => { header.protection.cipher.nonceHex = '00'; }],
    ['unsupported KDF configuration', (header: any) => { header.protection.kdf.iterations = 210_000; }],
    ['unreasonable KDF parameters', (header: any) => { header.protection.kdf.iterations = 9_999_999; }],
  ])('rejects a malformed header with %s', async (_label, mutate) => {
    const container = await createRainproofBackupContainer(
      buildRainproofBackup(createMinimalSnapshot(), exportedAt),
      'password',
      firstRandomness,
    );
    const malformed = replaceHeader(container, mutate);

    expect(() => inspectRainproofBackup(malformed)).toThrow(BackupReadError);
  });

  it('rejects truncated files, invalid serialized payloads, and old recovery-key containers', async () => {
    const unencrypted = await createRainproofBackupContainer(
      buildRainproofBackup(createMinimalSnapshot(), exportedAt),
      '',
    );
    const oldContainer = concatBytes(utf8ToBytes('RNPF0001'), unencrypted.subarray(8));

    expect(() => inspectRainproofBackup(unencrypted.subarray(0, 10))).toThrow(BackupReadError);
    expect(() => inspectRainproofBackup(oldContainer)).toThrow('not supported');

    const invalidPayload = replacePayloadAndChecksum(unencrypted, utf8ToBytes('not a gzip payload'));
    await expect(validateRainproofBackup(invalidPayload)).rejects.toMatchObject({ code: 'invalid_backup' });
  });
});

function collectStages(
  stages: BackupContainerStage[],
  timings: BackupStageTiming[] = [],
): BackupContainerObserver {
  return {
    onStageStart(_operation, stage) {
      stages.push(stage);
    },
    onStageComplete(timing) {
      timings.push(timing);
    },
  };
}

function createRandomness(saltStart: number, nonceStart: number): RainproofBackupRandomness {
  return {
    salt: Uint8Array.from({ length: 16 }, (_, index) => saltStart + index),
    nonce: Uint8Array.from({ length: 24 }, (_, index) => nonceStart + index),
  };
}

function readRawHeader(container: Uint8Array): any {
  const headerLength = new DataView(container.buffer, container.byteOffset + 8, 4).getUint32(0, false);
  return JSON.parse(new TextDecoder().decode(container.subarray(12, 12 + headerLength)));
}

function replaceHeader(container: Uint8Array, mutate: (header: any) => void): Uint8Array {
  const oldHeaderLength = new DataView(container.buffer, container.byteOffset + 8, 4).getUint32(0, false);
  const payload = container.subarray(12 + oldHeaderLength);
  const header = readRawHeader(container);
  mutate(header);
  return encodeContainerHeader(header, payload);
}

function replacePayloadAndChecksum(container: Uint8Array, payload: Uint8Array): Uint8Array {
  const header = readRawHeader(container);
  header.protection.checksum.digestHex = bytesToHex(sha256(payload));
  return encodeContainerHeader(header, payload);
}

function encodeContainerHeader(header: any, payload: Uint8Array): Uint8Array {
  const headerBytes = utf8ToBytes(JSON.stringify(header));
  const headerLength = new Uint8Array(4);
  new DataView(headerLength.buffer).setUint32(0, headerBytes.length, false);
  return concatBytes(utf8ToBytes('RNPF0002'), headerLength, headerBytes, payload);
}

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
