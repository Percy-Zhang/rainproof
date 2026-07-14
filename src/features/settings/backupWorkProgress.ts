import type { BackupContainerOperation, BackupContainerStage } from '../../domain/backupContainer';

export type BackupWorkOperation = BackupContainerOperation | 'inspection' | 'restore';

export type BackupWorkStage =
  | BackupContainerStage
  | 'read-file'
  | 'inspect-file'
  | 'preview'
  | 'write-file'
  | 'share-file'
  | 'prepare-restore'
  | 'restore-data'
  | 'refresh-state'
  | 'finish';

export type BackupWorkProgress = {
  operation: BackupWorkOperation;
  stage: BackupWorkStage;
  label: string;
  percentage: number;
};

export function getContainerWorkProgress(
  operation: BackupContainerOperation,
  stage: BackupContainerStage,
  passwordProtected: boolean,
): BackupWorkProgress {
  if (operation === 'export') {
    return exportProgress(stage, passwordProtected);
  }
  return validationProgress(stage, passwordProtected);
}

export function getBackupWorkProgress(
  operation: BackupWorkOperation,
  stage: Exclude<BackupWorkStage, BackupContainerStage>,
): BackupWorkProgress {
  const values: Record<string, Omit<BackupWorkProgress, 'operation' | 'stage'>> = {
    'inspection:read-file': { label: 'Reading backup...', percentage: 25 },
    'inspection:inspect-file': { label: 'Checking backup...', percentage: 80 },
    'export:write-file': { label: 'Writing backup...', percentage: 92 },
    'export:share-file': { label: 'Opening share options...', percentage: 98 },
    'validation:preview': { label: 'Preparing preview...', percentage: 98 },
    'restore:prepare-restore': { label: 'Preparing restore...', percentage: 10 },
    'restore:restore-data': { label: 'Restoring data...', percentage: 45 },
    'restore:refresh-state': { label: 'Refreshing Rainproof...', percentage: 82 },
    'restore:finish': { label: 'Finishing...', percentage: 100 },
  };
  const value = values[`${operation}:${stage}`];
  if (!value) {
    throw new Error(`Unsupported backup progress stage: ${operation}:${stage}`);
  }
  return { operation, stage, ...value };
}

export function mergeBackupWorkProgress(
  current: BackupWorkProgress | null,
  next: BackupWorkProgress,
): BackupWorkProgress {
  if (!current || current.operation !== next.operation) {
    return next;
  }
  return {
    ...next,
    percentage: Math.max(current.percentage, next.percentage),
  };
}

function exportProgress(stage: BackupContainerStage, passwordProtected: boolean): BackupWorkProgress {
  const values: Partial<Record<BackupContainerStage, { label: string; percentage: number }>> = {
    'build-snapshot': { label: 'Preparing data...', percentage: 4 },
    'validate-payload': { label: 'Checking data...', percentage: 10 },
    serialize: { label: 'Preparing backup...', percentage: 15 },
    encode: { label: 'Preparing backup...', percentage: 20 },
    compress: { label: 'Compressing backup...', percentage: 25 },
    checksum: { label: 'Checking backup...', percentage: 65 },
    'build-header': { label: 'Preparing backup file...', percentage: 55 },
    'build-container': { label: 'Preparing backup file...', percentage: passwordProtected ? 88 : 82 },
    'derive-key': { label: 'Preparing password protection...', percentage: 60 },
    encrypt: { label: 'Encrypting backup...', percentage: 82 },
  };
  return containerProgress('export', stage, values);
}

function validationProgress(stage: BackupContainerStage, passwordProtected: boolean): BackupWorkProgress {
  const values: Partial<Record<BackupContainerStage, { label: string; percentage: number }>> = {
    'parse-container': { label: 'Reading backup...', percentage: 10 },
    'derive-key': { label: 'Checking password...', percentage: 20 },
    decrypt: { label: 'Decrypting backup...', percentage: 52 },
    checksum: { label: 'Checking backup...', percentage: 40 },
    decompress: { label: 'Decompressing backup...', percentage: passwordProtected ? 65 : 55 },
    decode: { label: 'Checking backup...', percentage: 78 },
    'parse-payload': { label: 'Checking backup...', percentage: 85 },
    'validate-payload': { label: 'Checking backup...', percentage: 92 },
  };
  return containerProgress('validation', stage, values);
}

function containerProgress(
  operation: BackupContainerOperation,
  stage: BackupContainerStage,
  values: Partial<Record<BackupContainerStage, { label: string; percentage: number }>>,
): BackupWorkProgress {
  const value = values[stage];
  if (!value) {
    throw new Error(`Unsupported ${operation} progress stage: ${stage}`);
  }
  return { operation, stage, ...value };
}
