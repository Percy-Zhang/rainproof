import {
  getBackupWorkProgress,
  getContainerWorkProgress,
  mergeBackupWorkProgress,
} from '../backupWorkProgress';

describe('backup work progress', () => {
  it('keeps progress monotonic within one operation and resets for a new operation', () => {
    const compressing = getContainerWorkProgress('export', 'compress', true);
    const protecting = getContainerWorkProgress('export', 'derive-key', true);
    const stalePreparing = getContainerWorkProgress('export', 'serialize', true);

    expect(mergeBackupWorkProgress(compressing, protecting).percentage).toBeGreaterThan(
      compressing.percentage,
    );
    expect(mergeBackupWorkProgress(protecting, stalePreparing).percentage).toBe(
      protecting.percentage,
    );
    expect(
      mergeBackupWorkProgress(protecting, getContainerWorkProgress('validation', 'parse-container', true)),
    ).toMatchObject({ operation: 'validation', percentage: 10 });
  });

  it('uses protection wording only for protected export and validation stages', () => {
    expect(getContainerWorkProgress('export', 'derive-key', true).label).toBe(
      'Preparing password protection...',
    );
    expect(getContainerWorkProgress('export', 'encrypt', true).label).toBe('Encrypting backup...');
    expect(getContainerWorkProgress('validation', 'derive-key', true).label).toBe(
      'Checking password...',
    );
    expect(getContainerWorkProgress('validation', 'decrypt', true).label).toBe(
      'Decrypting backup...',
    );
    expect(getContainerWorkProgress('export', 'checksum', false).label).toBe('Checking backup...');
    expect(getContainerWorkProgress('validation', 'checksum', false).label).toBe('Checking backup...');
  });

  it('uses real write, share, preview, database, and refresh stage boundaries', () => {
    expect(getBackupWorkProgress('export', 'write-file')).toMatchObject({ percentage: 92 });
    expect(getBackupWorkProgress('export', 'share-file')).toMatchObject({ percentage: 98 });
    expect(getBackupWorkProgress('validation', 'preview')).toMatchObject({ percentage: 98 });
    expect(getBackupWorkProgress('restore', 'restore-data')).toMatchObject({ percentage: 45 });
    expect(getBackupWorkProgress('restore', 'refresh-state')).toMatchObject({ percentage: 82 });
    expect(getBackupWorkProgress('restore', 'finish')).toMatchObject({ percentage: 100 });
  });
});
