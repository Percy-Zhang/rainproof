import appConfig from '../../app.json';
import { SCHEMA_VERSION } from '../storage/schema';

export const APP_NAME = appConfig.expo.name;
export const APP_VERSION = appConfig.expo.version;
export const APP_BUILD_VERSION_CODE = appConfig.expo.android?.versionCode ?? null;
export const DATABASE_SCHEMA_VERSION = SCHEMA_VERSION;

export const BACKUP_FORMAT_VERSION = 1;
export const MIN_SUPPORTED_BACKUP_FORMAT_VERSION = 1;
export const MIN_SUPPORTED_BACKUP_APP_VERSION = APP_VERSION;

export type BackupMetadata = {
  appName: string;
  appVersion: string;
  appBuildVersionCode: number | null;
  schemaVersion: number;
  backupFormatVersion: number;
  minSupportedBackupFormatVersion: number;
  minSupportedAppVersion: string;
  exportedAt: string;
};

export type BackupFormatCompatibility =
  | {
      supported: true;
      reason: 'supported';
    }
  | {
      supported: false;
      reason: 'invalid_version' | 'unsupported_legacy_version' | 'update_required';
    };

export function getDatabaseSchemaVersion(): number {
  return DATABASE_SCHEMA_VERSION;
}

export function createBackupMetadata(exportedAt = new Date().toISOString()): BackupMetadata {
  return {
    appName: APP_NAME,
    appVersion: APP_VERSION,
    appBuildVersionCode: APP_BUILD_VERSION_CODE,
    schemaVersion: DATABASE_SCHEMA_VERSION,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    minSupportedBackupFormatVersion: MIN_SUPPORTED_BACKUP_FORMAT_VERSION,
    minSupportedAppVersion: MIN_SUPPORTED_BACKUP_APP_VERSION,
    exportedAt,
  };
}

// Future restore/import should validate backup metadata before applying data in a restore transaction.
export function checkBackupFormatCompatibility(backupFormatVersion: unknown): BackupFormatCompatibility {
  if (!Number.isInteger(backupFormatVersion) || Number(backupFormatVersion) <= 0) {
    return {
      supported: false,
      reason: 'invalid_version',
    };
  }

  const numericVersion = Number(backupFormatVersion);

  if (numericVersion > BACKUP_FORMAT_VERSION) {
    return {
      supported: false,
      reason: 'update_required',
    };
  }

  if (numericVersion < MIN_SUPPORTED_BACKUP_FORMAT_VERSION) {
    return {
      supported: false,
      reason: 'unsupported_legacy_version',
    };
  }

  return {
    supported: true,
    reason: 'supported',
  };
}
