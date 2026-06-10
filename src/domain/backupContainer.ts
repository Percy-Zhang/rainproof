import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  bytesToHex,
  bytesToUtf8,
  concatBytes,
  hexToBytes,
  utf8ToBytes,
} from '@noble/ciphers/utils.js';
import { gunzipSync, gzipSync } from 'fflate';

import {
  parseRainproofBackup,
  serializeRainproofBackup,
  type RainproofBackup,
} from './backupExport';

const MAGIC = utf8ToBytes('RNPF0001');
const HEADER_LENGTH_BYTES = 4;
const KEY_BYTES = 32;
const NONCE_BYTES = 24;

export const RAINPROOF_CONTAINER_FORMAT = 'rainproof-encrypted-backup';
export const RAINPROOF_CONTAINER_VERSION = 1;

export type BackupEncryptionKey = {
  id: string;
  bytes: Uint8Array;
};

export type RainproofContainerHeader = {
  format: typeof RAINPROOF_CONTAINER_FORMAT;
  containerVersion: typeof RAINPROOF_CONTAINER_VERSION;
  backupFormatVersion: number;
  exportedAt: string;
  keyId: string;
  cipher: 'xchacha20-poly1305';
  compression: 'gzip';
  nonceHex: string;
};

export function encryptRainproofBackup(
  backup: RainproofBackup,
  key: BackupEncryptionKey,
  nonce: Uint8Array,
): Uint8Array {
  assertKeyAndNonce(key, nonce);
  const header: RainproofContainerHeader = {
    format: RAINPROOF_CONTAINER_FORMAT,
    containerVersion: RAINPROOF_CONTAINER_VERSION,
    backupFormatVersion: backup.metadata.backupFormatVersion,
    exportedAt: backup.metadata.exportedAt,
    keyId: key.id,
    cipher: 'xchacha20-poly1305',
    compression: 'gzip',
    nonceHex: bytesToHex(nonce),
  };
  const headerBytes = utf8ToBytes(JSON.stringify(header));
  const prefix = concatBytes(MAGIC, encodeUint32(headerBytes.length), headerBytes);
  const compressed = gzipSync(utf8ToBytes(serializeRainproofBackup(backup)), { level: 9 });
  const ciphertext = xchacha20poly1305(key.bytes, nonce, prefix).encrypt(compressed);
  return concatBytes(prefix, ciphertext);
}

export function decryptRainproofBackup(
  container: Uint8Array,
  key: BackupEncryptionKey,
): RainproofBackup {
  const parsed = parseContainer(container);
  if (parsed.header.keyId !== key.id) {
    throw new Error('This backup uses a different Rainproof recovery key.');
  }
  if (key.bytes.length !== KEY_BYTES) {
    throw new Error('The Rainproof recovery key is invalid.');
  }

  try {
    const compressed = xchacha20poly1305(
      key.bytes,
      hexToBytes(parsed.header.nonceHex),
      parsed.prefix,
    ).decrypt(parsed.ciphertext);
    const backup = JSON.parse(bytesToUtf8(gunzipSync(compressed))) as unknown;
    return parseRainproofBackup(backup);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('This backup')) {
      throw error;
    }
    throw new Error('The backup could not be decrypted or is corrupted.');
  }
}

export function readRainproofContainerHeader(container: Uint8Array): RainproofContainerHeader {
  return parseContainer(container).header;
}

export function formatRecoveryKey(key: BackupEncryptionKey): string {
  const value = `${key.id}.${bytesToHex(key.bytes)}`.toUpperCase();
  return value.match(/.{1,8}/g)?.join('-') ?? value;
}

export function parseRecoveryKey(value: string): BackupEncryptionKey {
  const normalized = value.replace(/-/g, '').trim().toLowerCase();
  const separator = normalized.indexOf('.');
  if (separator <= 0) {
    throw new Error('The Rainproof recovery key is invalid.');
  }

  const id = normalized.slice(0, separator);
  const bytes = hexToBytes(normalized.slice(separator + 1));
  if (!id || bytes.length !== KEY_BYTES) {
    throw new Error('The Rainproof recovery key is invalid.');
  }
  return { id, bytes };
}

function parseContainer(container: Uint8Array): {
  header: RainproofContainerHeader;
  prefix: Uint8Array;
  ciphertext: Uint8Array;
} {
  const minimumLength = MAGIC.length + HEADER_LENGTH_BYTES + 16;
  if (container.length < minimumLength || !bytesEqual(container.subarray(0, MAGIC.length), MAGIC)) {
    throw new Error('This is not a Rainproof encrypted backup.');
  }

  const headerLength = decodeUint32(container, MAGIC.length);
  const headerStart = MAGIC.length + HEADER_LENGTH_BYTES;
  const headerEnd = headerStart + headerLength;
  if (headerLength <= 0 || headerEnd >= container.length) {
    throw new Error('The Rainproof backup header is invalid.');
  }

  let header: RainproofContainerHeader;
  try {
    header = JSON.parse(bytesToUtf8(container.subarray(headerStart, headerEnd))) as RainproofContainerHeader;
  } catch {
    throw new Error('The Rainproof backup header is invalid.');
  }
  if (
    header.format !== RAINPROOF_CONTAINER_FORMAT
    || header.containerVersion !== RAINPROOF_CONTAINER_VERSION
    || header.cipher !== 'xchacha20-poly1305'
    || header.compression !== 'gzip'
    || typeof header.keyId !== 'string'
    || typeof header.exportedAt !== 'string'
    || hexToBytes(header.nonceHex).length !== NONCE_BYTES
  ) {
    throw new Error('The Rainproof backup format is not supported.');
  }

  return {
    header,
    prefix: container.subarray(0, headerEnd),
    ciphertext: container.subarray(headerEnd),
  };
}

function assertKeyAndNonce(key: BackupEncryptionKey, nonce: Uint8Array): void {
  if (!key.id.trim() || key.bytes.length !== KEY_BYTES) {
    throw new Error('The Rainproof recovery key is invalid.');
  }
  if (nonce.length !== NONCE_BYTES) {
    throw new Error('The Rainproof backup nonce is invalid.');
  }
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
