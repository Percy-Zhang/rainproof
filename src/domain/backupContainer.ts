import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  bytesToHex,
  bytesToUtf8,
  concatBytes,
  hexToBytes,
  utf8ToBytes,
} from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { gunzipSync, gzipSync } from 'fflate';

import { derivePasswordKeyResponsively } from './backupPasswordKdf';
import {
  buildRainproofBackup,
  parseDetachedRainproofBackup,
  parseRainproofBackup,
  serializeRainproofBackup,
  type RainproofBackup,
} from './backupExport';
import type { AppSnapshot } from './types';
import { BACKUP_FORMAT_VERSION } from './versioning';

const MAGIC = utf8ToBytes('RNPF0002');
const HEADER_LENGTH_BYTES = 4;
const MAX_HEADER_BYTES = 16 * 1024;
const SALT_BYTES = 16;
const NONCE_BYTES = 24;
const AUTH_TAG_BYTES = 16;
// Level 9 provides the best compression ratio for JSON backups, despite the higher JS-thread cost.
const BACKUP_GZIP_LEVEL = 9;

export const RAINPROOF_CONTAINER_FORMAT = 'rainproof-backup';
export const RAINPROOF_CONTAINER_VERSION = 1;
export const RAINPROOF_PASSWORD_KDF_ITERATIONS = 1000;

export type BackupContainerOperation = 'export' | 'validation';

export type BackupContainerStage =
  | 'build-snapshot'
  | 'validate-payload'
  | 'serialize'
  | 'encode'
  | 'compress'
  | 'checksum'
  | 'derive-key'
  | 'encrypt'
  | 'build-header'
  | 'build-container'
  | 'parse-container'
  | 'decrypt'
  | 'decompress'
  | 'decode'
  | 'parse-payload';

export type BackupStageTiming = {
  operation: BackupContainerOperation;
  stage: BackupContainerStage;
  durationMs: number;
  inputBytes?: number;
  outputBytes?: number;
  status: 'success' | 'error';
};

export type BackupContainerObserver = {
  onStageStart?: (operation: BackupContainerOperation, stage: BackupContainerStage) => Promise<void> | void;
  onStageComplete?: (timing: BackupStageTiming) => void;
};

export type BackupProtection =
  | {
      mode: 'none';
      checksum: {
        algorithm: 'sha256';
        digestHex: string;
      };
    }
  | {
      mode: 'password';
      kdf: {
        algorithm: 'pbkdf2-hmac-sha256';
        iterations: typeof RAINPROOF_PASSWORD_KDF_ITERATIONS;
        saltHex: string;
      };
      cipher: {
        algorithm: 'xchacha20-poly1305';
        nonceHex: string;
      };
    };

export type RainproofContainerHeader = {
  format: typeof RAINPROOF_CONTAINER_FORMAT;
  version: typeof RAINPROOF_CONTAINER_VERSION;
  createdAt: string;
  appVersion: string;
  backupFormatVersion: number;
  compression: 'gzip';
  protection: BackupProtection;
};

export type RainproofBackupInspection = {
  createdAt: string;
  appVersion: string;
  formatVersion: number;
  backupFormatVersion: number;
  protectionMode: BackupProtection['mode'];
};

export type RainproofBackupRandomness = {
  salt: Uint8Array;
  nonce: Uint8Array;
};

export type BackupReadErrorCode =
  | 'unsupported_format'
  | 'password_required'
  | 'incorrect_password_or_corrupt_backup'
  | 'invalid_backup';

const BACKUP_READ_ERROR_MESSAGES: Record<BackupReadErrorCode, string> = {
  unsupported_format: 'This Rainproof backup format is not supported.',
  password_required: 'Enter the password for this backup.',
  incorrect_password_or_corrupt_backup: 'The password is incorrect or the backup is corrupted.',
  invalid_backup: 'The selected backup is invalid or corrupted.',
};

export class BackupReadError extends Error {
  constructor(readonly code: BackupReadErrorCode) {
    super(BACKUP_READ_ERROR_MESSAGES[code]);
    this.name = 'BackupReadError';
  }
}

export async function createRainproofBackupContainer(
  backup: RainproofBackup,
  password: string,
  randomness?: RainproofBackupRandomness,
  observer?: BackupContainerObserver,
): Promise<Uint8Array> {
  return createRainproofBackupContainerFromBackup(backup, password, randomness, observer, false);
}

export async function createRainproofBackupContainerFromSnapshot(
  snapshot: AppSnapshot,
  exportedAt: string,
  password: string,
  randomness?: RainproofBackupRandomness,
  observer?: BackupContainerObserver,
): Promise<Uint8Array> {
  const backup = await runBackupStage(
    'export',
    'build-snapshot',
    observer,
    () => buildRainproofBackup(snapshot, exportedAt),
  );
  return createRainproofBackupContainerFromBackup(backup, password, randomness, observer, true);
}

async function createRainproofBackupContainerFromBackup(
  backup: RainproofBackup,
  password: string,
  randomness: RainproofBackupRandomness | undefined,
  observer: BackupContainerObserver | undefined,
  detached: boolean,
): Promise<Uint8Array> {
  const validatedBackup = await runBackupStage(
    'export',
    'validate-payload',
    observer,
    () => detached ? parseDetachedRainproofBackup(backup) : parseRainproofBackup(backup),
  );
  const serialized = await runBackupStage(
    'export',
    'serialize',
    observer,
    () => serializeRainproofBackup(validatedBackup),
  );
  const encoded = await runBackupStage(
    'export',
    'encode',
    observer,
    () => utf8ToBytes(serialized),
    (result) => ({ inputBytes: serialized.length, outputBytes: result.length }),
  );
  const compressed = await runBackupStage(
    'export',
    'compress',
    observer,
    () => gzipSync(encoded, { level: BACKUP_GZIP_LEVEL }),
    (result) => ({ inputBytes: encoded.length, outputBytes: result.length }),
  );

  if (password === '') {
    const digestHex = await runBackupStage(
      'export',
      'checksum',
      observer,
      () => bytesToHex(sha256(compressed)),
      () => ({ inputBytes: compressed.length }),
    );
    return runBackupStage(
      'export',
      'build-container',
      observer,
      () => {
        const header = createHeader(validatedBackup, {
          mode: 'none',
          checksum: {
            algorithm: 'sha256',
            digestHex,
          },
        });
        return concatBytes(buildPrefix(header), compressed);
      },
      (result) => ({ inputBytes: compressed.length, outputBytes: result.length }),
    );
  }

  assertPasswordRandomness(randomness);
  const protection: Extract<BackupProtection, { mode: 'password' }> = {
    mode: 'password',
    kdf: {
      algorithm: 'pbkdf2-hmac-sha256',
      iterations: RAINPROOF_PASSWORD_KDF_ITERATIONS,
      saltHex: bytesToHex(randomness.salt),
    },
    cipher: {
      algorithm: 'xchacha20-poly1305',
      nonceHex: bytesToHex(randomness.nonce),
    },
  };
  const prefix = await runBackupStage(
    'export',
    'build-header',
    observer,
    () => buildPrefix(createHeader(validatedBackup, protection)),
    (result) => ({ outputBytes: result.length }),
  );
  const key = await runBackupStage(
    'export',
    'derive-key',
    observer,
    () => derivePasswordKeyResponsively(
      password,
      randomness.salt,
      RAINPROOF_PASSWORD_KDF_ITERATIONS,
    ),
  );
  try {
    const encrypted = await runBackupStage(
      'export',
      'encrypt',
      observer,
      () => xchacha20poly1305(key, randomness.nonce, prefix).encrypt(compressed),
      (result) => ({ inputBytes: compressed.length, outputBytes: result.length }),
    );
    return runBackupStage(
      'export',
      'build-container',
      observer,
      () => concatBytes(prefix, encrypted),
      (result) => ({ inputBytes: encrypted.length, outputBytes: result.length }),
    );
  } finally {
    key.fill(0);
  }
}

export function inspectRainproofBackup(container: Uint8Array): RainproofBackupInspection {
  const { header } = parseContainer(container);
  return {
    createdAt: header.createdAt,
    appVersion: header.appVersion,
    formatVersion: header.version,
    backupFormatVersion: header.backupFormatVersion,
    protectionMode: header.protection.mode,
  };
}

export async function validateRainproofBackup(
  container: Uint8Array,
  password = '',
  observer?: BackupContainerObserver,
): Promise<RainproofBackup> {
  const parsed = await runBackupStage(
    'validation',
    'parse-container',
    observer,
    () => parseContainer(container),
    () => ({ inputBytes: container.length }),
  );
  let compressed: Uint8Array;

  if (parsed.header.protection.mode === 'password') {
    if (password === '') {
      throw new BackupReadError('password_required');
    }

    const salt = decodeHex(parsed.header.protection.kdf.saltHex, SALT_BYTES);
    const nonce = decodeHex(parsed.header.protection.cipher.nonceHex, NONCE_BYTES);
    const kdfIterations = parsed.header.protection.kdf.iterations;
    const key = await runBackupStage(
      'validation',
      'derive-key',
      observer,
      () => derivePasswordKeyResponsively(
        password,
        salt,
        kdfIterations,
      ),
    );
    try {
      compressed = await runBackupStage(
        'validation',
        'decrypt',
        observer,
        () => xchacha20poly1305(key, nonce, parsed.prefix).decrypt(parsed.payload),
        (result) => ({ inputBytes: parsed.payload.length, outputBytes: result.length }),
      );
    } catch {
      throw new BackupReadError('incorrect_password_or_corrupt_backup');
    } finally {
      key.fill(0);
    }
  } else {
    const expectedChecksum = decodeHex(parsed.header.protection.checksum.digestHex, sha256.outputLen);
    const checksumMatches = await runBackupStage(
      'validation',
      'checksum',
      observer,
      () => bytesEqual(sha256(parsed.payload), expectedChecksum),
      () => ({ inputBytes: parsed.payload.length }),
    );
    if (!checksumMatches) {
      throw new BackupReadError('invalid_backup');
    }
    compressed = parsed.payload;
  }

  let backup: RainproofBackup;
  try {
    const decompressed = await runBackupStage(
      'validation',
      'decompress',
      observer,
      () => gunzipSync(compressed),
      (result) => ({ inputBytes: compressed.length, outputBytes: result.length }),
    );
    const decoded = await runBackupStage(
      'validation',
      'decode',
      observer,
      () => bytesToUtf8(decompressed),
      () => ({ inputBytes: decompressed.length }),
    );
    const parsedPayload = await runBackupStage(
      'validation',
      'parse-payload',
      observer,
      () => JSON.parse(decoded) as unknown,
      () => ({ inputBytes: decoded.length }),
    );
    backup = await runBackupStage(
      'validation',
      'validate-payload',
      observer,
      () => parseDetachedRainproofBackup(parsedPayload),
    );
  } catch {
    throw new BackupReadError('invalid_backup');
  }

  if (
    backup.metadata.exportedAt !== parsed.header.createdAt
    || backup.metadata.appVersion !== parsed.header.appVersion
    || backup.metadata.backupFormatVersion !== parsed.header.backupFormatVersion
  ) {
    throw new BackupReadError('invalid_backup');
  }

  return backup;
}

async function runBackupStage<T>(
  operation: BackupContainerOperation,
  stage: BackupContainerStage,
  observer: BackupContainerObserver | undefined,
  run: () => Promise<T> | T,
  getSizes?: (result: T) => Pick<BackupStageTiming, 'inputBytes' | 'outputBytes'> | undefined,
): Promise<T> {
  await observer?.onStageStart?.(operation, stage);
  const startedAt = Date.now();
  try {
    const result = await run();
    observer?.onStageComplete?.({
      operation,
      stage,
      durationMs: Date.now() - startedAt,
      status: 'success',
      ...getSizes?.(result),
    });
    return result;
  } catch (error) {
    observer?.onStageComplete?.({
      operation,
      stage,
      durationMs: Date.now() - startedAt,
      status: 'error',
    });
    throw error;
  }
}

function createHeader(backup: RainproofBackup, protection: BackupProtection): RainproofContainerHeader {
  return {
    format: RAINPROOF_CONTAINER_FORMAT,
    version: RAINPROOF_CONTAINER_VERSION,
    createdAt: backup.metadata.exportedAt,
    appVersion: backup.metadata.appVersion,
    backupFormatVersion: backup.metadata.backupFormatVersion,
    compression: 'gzip',
    protection,
  };
}

function buildPrefix(header: RainproofContainerHeader): Uint8Array {
  const headerBytes = utf8ToBytes(JSON.stringify(header));
  if (headerBytes.length > MAX_HEADER_BYTES) {
    throw new BackupReadError('invalid_backup');
  }
  return concatBytes(MAGIC, encodeUint32(headerBytes.length), headerBytes);
}

function parseContainer(container: Uint8Array): {
  header: RainproofContainerHeader;
  prefix: Uint8Array;
  payload: Uint8Array;
} {
  if (container.length < MAGIC.length + HEADER_LENGTH_BYTES + 1) {
    throw new BackupReadError('invalid_backup');
  }
  if (!bytesEqual(container.subarray(0, MAGIC.length), MAGIC)) {
    throw new BackupReadError('unsupported_format');
  }

  const headerLength = decodeUint32(container, MAGIC.length);
  const headerStart = MAGIC.length + HEADER_LENGTH_BYTES;
  const headerEnd = headerStart + headerLength;
  if (headerLength <= 0 || headerLength > MAX_HEADER_BYTES || headerEnd >= container.length) {
    throw new BackupReadError('invalid_backup');
  }

  let value: unknown;
  try {
    value = JSON.parse(bytesToUtf8(container.subarray(headerStart, headerEnd)));
  } catch {
    throw new BackupReadError('invalid_backup');
  }
  const header = parseHeader(value);
  const payload = container.subarray(headerEnd);
  if (header.protection.mode === 'password' && payload.length < AUTH_TAG_BYTES) {
    throw new BackupReadError('invalid_backup');
  }

  return {
    header,
    prefix: container.subarray(0, headerEnd),
    payload,
  };
}

function parseHeader(value: unknown): RainproofContainerHeader {
  if (!isRecord(value)) {
    throw new BackupReadError('invalid_backup');
  }
  if (
    value.format !== RAINPROOF_CONTAINER_FORMAT
    || value.version !== RAINPROOF_CONTAINER_VERSION
    || value.backupFormatVersion !== BACKUP_FORMAT_VERSION
    || value.compression !== 'gzip'
  ) {
    throw new BackupReadError('unsupported_format');
  }
  if (
    typeof value.createdAt !== 'string'
    || !Number.isFinite(Date.parse(value.createdAt))
    || typeof value.appVersion !== 'string'
    || value.appVersion.length === 0
    || value.appVersion.length > 100
  ) {
    throw new BackupReadError('invalid_backup');
  }

  return {
    format: RAINPROOF_CONTAINER_FORMAT,
    version: RAINPROOF_CONTAINER_VERSION,
    createdAt: value.createdAt,
    appVersion: value.appVersion,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    compression: 'gzip',
    protection: parseProtection(value.protection),
  };
}

function parseProtection(value: unknown): BackupProtection {
  if (!isRecord(value) || (value.mode !== 'none' && value.mode !== 'password')) {
    throw new BackupReadError('unsupported_format');
  }

  if (value.mode === 'none') {
    if (
      !isRecord(value.checksum)
      || value.checksum.algorithm !== 'sha256'
      || !isValidHex(value.checksum.digestHex, sha256.outputLen)
    ) {
      throw new BackupReadError('invalid_backup');
    }
    return {
      mode: 'none',
      checksum: {
        algorithm: 'sha256',
        digestHex: value.checksum.digestHex,
      },
    };
  }

  if (
    !isRecord(value.kdf)
    || value.kdf.algorithm !== 'pbkdf2-hmac-sha256'
    || value.kdf.iterations !== RAINPROOF_PASSWORD_KDF_ITERATIONS
    || !isValidHex(value.kdf.saltHex, SALT_BYTES)
    || !isRecord(value.cipher)
    || value.cipher.algorithm !== 'xchacha20-poly1305'
    || !isValidHex(value.cipher.nonceHex, NONCE_BYTES)
  ) {
    throw new BackupReadError('invalid_backup');
  }
  return {
    mode: 'password',
    kdf: {
      algorithm: 'pbkdf2-hmac-sha256',
      iterations: RAINPROOF_PASSWORD_KDF_ITERATIONS,
      saltHex: value.kdf.saltHex,
    },
    cipher: {
      algorithm: 'xchacha20-poly1305',
      nonceHex: value.cipher.nonceHex,
    },
  };
}

function assertPasswordRandomness(
  value: RainproofBackupRandomness | undefined,
): asserts value is RainproofBackupRandomness {
  if (!value || value.salt.length !== SALT_BYTES || value.nonce.length !== NONCE_BYTES) {
    throw new BackupReadError('invalid_backup');
  }
}

function decodeHex(value: string, expectedBytes: number): Uint8Array {
  if (!isValidHex(value, expectedBytes)) {
    throw new BackupReadError('invalid_backup');
  }
  return hexToBytes(value);
}

function isValidHex(value: unknown, expectedBytes: number): value is string {
  return typeof value === 'string'
    && value.length === expectedBytes * 2
    && /^[0-9a-f]+$/i.test(value);
}

function encodeUint32(value: number): Uint8Array {
  const bytes = new Uint8Array(HEADER_LENGTH_BYTES);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function decodeUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, HEADER_LENGTH_BYTES).getUint32(0, false);
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
