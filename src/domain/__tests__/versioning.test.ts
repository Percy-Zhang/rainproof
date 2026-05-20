import {
  APP_BUILD_VERSION_CODE,
  APP_NAME,
  APP_VERSION,
  BACKUP_FORMAT_VERSION,
  checkBackupFormatCompatibility,
  createBackupMetadata,
  getDatabaseSchemaVersion,
  MIN_SUPPORTED_BACKUP_APP_VERSION,
  MIN_SUPPORTED_BACKUP_FORMAT_VERSION,
} from '../versioning';
import { SCHEMA_VERSION } from '../../storage/schema';

describe('versioning metadata', () => {
  it('accepts the current backup format version', () => {
    expect(checkBackupFormatCompatibility(BACKUP_FORMAT_VERSION)).toEqual({
      supported: true,
      reason: 'supported',
    });
  });

  it('rejects future backup format versions until the app is updated', () => {
    expect(checkBackupFormatCompatibility(BACKUP_FORMAT_VERSION + 1)).toEqual({
      supported: false,
      reason: 'update_required',
    });
  });

  it.each([0, -1, 1.5, '1', null, undefined])('rejects invalid backup format version %p', (version) => {
    expect(checkBackupFormatCompatibility(version)).toEqual({
      supported: false,
      reason: 'invalid_version',
    });
  });

  it('exposes the current SQLite schema version', () => {
    expect(getDatabaseSchemaVersion()).toBe(SCHEMA_VERSION);
  });

  it('creates future backup metadata from central version sources', () => {
    expect(createBackupMetadata('2026-05-20T00:00:00.000Z')).toEqual({
      appName: APP_NAME,
      appVersion: APP_VERSION,
      appBuildVersionCode: APP_BUILD_VERSION_CODE,
      schemaVersion: SCHEMA_VERSION,
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      minSupportedBackupFormatVersion: MIN_SUPPORTED_BACKUP_FORMAT_VERSION,
      minSupportedAppVersion: MIN_SUPPORTED_BACKUP_APP_VERSION,
      exportedAt: '2026-05-20T00:00:00.000Z',
    });
  });
});
