import { getRandomBytesAsync } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import {
  File,
  Paths,
  type PickSingleFileOptions,
  type PickSingleFileResult,
} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { hasRainproofBackupMagic } from '../../domain/backupContainer';

export type BackupPickerMethod = 'file-system' | 'document-picker';

export type ReadableBackupFile = {
  readonly exists: boolean;
  readonly size: number | null;
  bytes: () => Promise<Uint8Array>;
};

export type SelectedBackupFile = {
  file: ReadableBackupFile;
  mimeType: string | null;
  name: string;
  pickerMethod: BackupPickerMethod;
  size: number | null;
  uri: string;
};

export type BackupFileReadResult = {
  actualBytes: number;
  bytes: Uint8Array;
  fileExists: boolean | null;
  fileSize: number | null;
  magicMatches: true;
  pickerMethod: BackupPickerMethod;
};

export type BackupFileReadStage = 'read-bytes' | 'validate-bytes';
export type BackupFileReadFailure =
  | 'read-failed'
  | 'invalid-runtime-type'
  | 'empty-file'
  | 'size-mismatch'
  | 'invalid-magic';

type BackupFileReadErrorMetadata = {
  actualBytes?: number | null;
  fileExists: boolean | null;
  fileSize: number | null;
  magicMatches?: boolean | null;
};

export class BackupFileAccessError extends Error {
  readonly actualBytes: number | null;
  readonly fileExists: boolean | null;
  readonly fileSize: number | null;
  readonly magicMatches: boolean | null;
  readonly nativeCode: string | null;
  readonly nativeErrorName: string | null;

  constructor(
    readonly stage: BackupFileReadStage,
    readonly reason: BackupFileReadFailure,
    cause: unknown,
    metadata: BackupFileReadErrorMetadata,
  ) {
    super('The selected backup file could not be read.');
    this.name = 'BackupFileAccessError';
    this.actualBytes = metadata.actualBytes ?? null;
    this.fileExists = metadata.fileExists;
    this.fileSize = metadata.fileSize;
    this.magicMatches = metadata.magicMatches ?? null;
    this.nativeCode = getErrorCode(cause);
    this.nativeErrorName = getErrorName(cause);
  }
}

export class BackupFilePickerError extends Error {
  readonly nativeCode: string | null;
  readonly nativeErrorName: string | null;

  constructor(readonly pickerMethod: BackupPickerMethod, cause: unknown) {
    super('The backup file picker could not be opened.');
    this.name = 'BackupFilePickerError';
    this.nativeCode = getErrorCode(cause);
    this.nativeErrorName = getErrorName(cause);
  }
}

export type NativeBackupFilePicker = (
  options: PickSingleFileOptions,
) => Promise<PickSingleFileResult>;

export type WebBackupFilePicker = (
  options: DocumentPicker.DocumentPickerOptions,
) => Promise<DocumentPicker.DocumentPickerResult>;

export type BackupPickerDependencies = {
  pickNativeFile?: NativeBackupFilePicker;
  pickWebFile?: WebBackupFilePicker;
};

export type BackupSettingsServices = {
  getRandomBytes: (length: number) => Promise<Uint8Array>;
  pickBackupFile: () => Promise<SelectedBackupFile | null>;
  readBackupFile: (selected: SelectedBackupFile) => Promise<BackupFileReadResult>;
  writeBackupFile: (filename: string, bytes: Uint8Array) => Promise<string>;
  shareBackupFile: (uri: string) => Promise<void>;
};

export const defaultBackupSettingsServices: BackupSettingsServices = {
  getRandomBytes: getRandomBytesAsync,
  async pickBackupFile() {
    return pickBackupFileForPlatform(Platform.OS);
  },
  async readBackupFile(selected) {
    return readSelectedBackupFile(selected);
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

export async function pickBackupFileForPlatform(
  platform: string,
  {
    pickNativeFile = (options) => File.pickFileAsync(options),
    pickWebFile = (options) => DocumentPicker.getDocumentAsync(options),
  }: BackupPickerDependencies = {},
): Promise<SelectedBackupFile | null> {
  if (platform === 'web') {
    return pickWebBackupFile(pickWebFile);
  }
  return pickNativeBackupFile(pickNativeFile);
}

async function pickNativeBackupFile(
  pickFile: NativeBackupFilePicker,
): Promise<SelectedBackupFile | null> {
  let result: PickSingleFileResult;
  try {
    result = await pickFile({
      mimeTypes: '*/*',
      multipleFiles: false,
    });
  } catch (error) {
    throw new BackupFilePickerError('file-system', error);
  }

  if (result.canceled) {
    return null;
  }

  const file = result.result;
  return {
    file,
    mimeType: readFileMetadata(() => file.type) || null,
    name: file.name,
    pickerMethod: 'file-system',
    size: readFileMetadata(() => file.size),
    uri: file.uri,
  };
}

async function pickWebBackupFile(
  pickFile: WebBackupFilePicker,
): Promise<SelectedBackupFile | null> {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await pickFile({
      base64: false,
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    });
  } catch (error) {
    throw new BackupFilePickerError('document-picker', error);
  }

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset.file) {
    throw new BackupFilePickerError(
      'document-picker',
      new Error('The browser picker did not return a readable file.'),
    );
  }
  const browserFile = asset.file;
  return {
    file: {
      async bytes() {
        return new Uint8Array(await browserFile.arrayBuffer());
      },
      exists: true,
      size: browserFile.size,
    },
    mimeType: asset.mimeType ?? (browserFile.type || null),
    name: asset.name,
    pickerMethod: 'document-picker',
    size: asset.size ?? browserFile.size,
    uri: asset.uri,
  };
}

export async function readSelectedBackupFile(
  selected: SelectedBackupFile,
): Promise<BackupFileReadResult> {
  const fileExists = readFileMetadata(() => selected.file.exists);
  const fileSize = readFileMetadata(() => selected.file.size);
  let value: unknown;
  try {
    value = await selected.file.bytes();
  } catch (error) {
    throw new BackupFileAccessError('read-bytes', 'read-failed', error, {
      fileExists,
      fileSize,
    });
  }

  if (!isUint8Array(value)) {
    throw new BackupFileAccessError('validate-bytes', 'invalid-runtime-type', null, {
      fileExists,
      fileSize,
    });
  }

  const actualBytes = value.length;
  if (actualBytes === 0) {
    throw new BackupFileAccessError('validate-bytes', 'empty-file', null, {
      actualBytes,
      fileExists,
      fileSize,
      magicMatches: false,
    });
  }
  if (selected.size !== null && actualBytes !== selected.size) {
    throw new BackupFileAccessError('validate-bytes', 'size-mismatch', null, {
      actualBytes,
      fileExists,
      fileSize,
      magicMatches: hasRainproofBackupMagic(value),
    });
  }

  const magicMatches = hasRainproofBackupMagic(value);
  if (!magicMatches) {
    throw new BackupFileAccessError('validate-bytes', 'invalid-magic', null, {
      actualBytes,
      fileExists,
      fileSize,
      magicMatches,
    });
  }

  return {
    actualBytes,
    bytes: value,
    fileExists,
    fileSize,
    magicMatches: true,
    pickerMethod: selected.pickerMethod,
  };
}

function readFileMetadata<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    return null;
  }
}

function isUint8Array(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array
    || (
      ArrayBuffer.isView(value)
      && value.constructor.name === 'Uint8Array'
      && 'BYTES_PER_ELEMENT' in value
      && value.BYTES_PER_ELEMENT === 1
    );
}

function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return null;
  }
  return typeof error.code === 'string' ? error.code : null;
}

function getErrorName(error: unknown): string | null {
  return error instanceof Error ? error.name : null;
}
