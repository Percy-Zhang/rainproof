import type { File } from 'expo-file-system';

import {
  createRainproofBackupContainer,
  inspectRainproofBackup,
  validateRainproofBackup,
} from '../../../domain/backupContainer';
import { buildRainproofBackup } from '../../../domain/backupExport';
import type { AppSnapshot } from '../../../domain/types';
import {
  BackupFileAccessError,
  pickBackupFileForPlatform,
  readSelectedBackupFile,
  type BackupPickerDependencies,
  type ReadableBackupFile,
  type SelectedBackupFile,
} from '../backupSettingsServices';

const validBackupBytes = new Uint8Array([
  ...Buffer.from('RNPF0002', 'ascii'),
  0,
  0,
  0,
  1,
  123,
]);

describe('backup settings services', () => {
  it('uses the FileSystem picker and reads the returned native File object directly', async () => {
    const file = nativeFile();
    const dependencies = pickerDependencies({ nativeFile: file });

    const selected = await pickBackupFileForPlatform('android', dependencies);

    expect(dependencies.pickNativeFile).toHaveBeenCalledWith({
      mimeTypes: '*/*',
      multipleFiles: false,
    });
    expect(dependencies.pickWebFile).not.toHaveBeenCalled();
    expect(selected?.file).toBe(file);

    const result = await readSelectedBackupFile(selected!);

    expect(file.bytes).toHaveBeenCalledTimes(1);
    expect(file.base64).not.toHaveBeenCalled();
    expect(result).toEqual({
      actualBytes: validBackupBytes.length,
      bytes: validBackupBytes,
      fileExists: true,
      fileSize: validBackupBytes.length,
      magicMatches: true,
      pickerMethod: 'file-system',
    });
  });

  it('treats native picker cancellation as a no-op without reading a file', async () => {
    const dependencies = pickerDependencies({ nativeCanceled: true });

    await expect(pickBackupFileForPlatform('ios', dependencies)).resolves.toBeNull();
    expect(dependencies.pickWebFile).not.toHaveBeenCalled();
  });

  it('reports an unexpected native picker failure without reading or inspecting data', async () => {
    const error = Object.assign(new Error('picker failed'), { code: 'ERR_PICKER' });
    const dependencies = pickerDependencies({ nativeError: error });

    await expect(pickBackupFileForPlatform('android', dependencies)).rejects.toMatchObject({
      nativeCode: 'ERR_PICKER',
      nativeErrorName: 'Error',
      pickerMethod: 'file-system',
    });
  });

  it('keeps web on DocumentPicker and reads the browser File without Base64', async () => {
    const browserFile = {
      arrayBuffer: jest.fn(async () => validBackupBytes.slice().buffer),
      name: 'selected.rainproof',
      size: validBackupBytes.length,
      type: 'application/octet-stream',
    } as unknown as globalThis.File;
    const dependencies = pickerDependencies({ browserFile });

    const selected = await pickBackupFileForPlatform('web', dependencies);

    expect(dependencies.pickNativeFile).not.toHaveBeenCalled();
    expect(dependencies.pickWebFile).toHaveBeenCalledWith({
      base64: false,
      copyToCacheDirectory: true,
      multiple: false,
      type: '*/*',
    });
    await expect(readSelectedBackupFile(selected!)).resolves.toMatchObject({
      bytes: validBackupBytes,
      pickerMethod: 'document-picker',
    });
    expect(browserFile.arrayBuffer).toHaveBeenCalledTimes(1);
  });

  it('keeps web picker cancellation as a no-op', async () => {
    const dependencies = pickerDependencies({ webCanceled: true });

    await expect(pickBackupFileForPlatform('web', dependencies)).resolves.toBeNull();
    expect(dependencies.pickNativeFile).not.toHaveBeenCalled();
  });

  it('reports a single native byte-read failure and does not run a fallback', async () => {
    const nativeError = Object.assign(new Error('read failed'), {
      code: 'ERR_INVALID_PERMISSION',
    });
    const file = nativeFile({
      bytes: jest.fn(async () => { throw nativeError; }),
    });

    await expect(readSelectedBackupFile(selectedFile(file))).rejects.toEqual(
      expect.objectContaining<Partial<BackupFileAccessError>>({
        actualBytes: null,
        nativeCode: 'ERR_INVALID_PERMISSION',
        nativeErrorName: 'Error',
        reason: 'read-failed',
        stage: 'read-bytes',
      }),
    );
    expect(file.bytes).toHaveBeenCalledTimes(1);
    expect(file.base64).not.toHaveBeenCalled();
  });

  it('rejects an invalid bytes runtime result', async () => {
    const file = nativeFile({
      bytes: jest.fn(async () => Array.from(validBackupBytes) as unknown as Uint8Array),
    });

    await expect(readSelectedBackupFile(selectedFile(file))).rejects.toMatchObject({
      reason: 'invalid-runtime-type',
      stage: 'validate-bytes',
    });
  });

  it('rejects an empty selected file', async () => {
    const file = nativeFile({
      bytes: jest.fn(async () => new Uint8Array()),
      size: 0,
    });

    await expect(readSelectedBackupFile(selectedFile(file, { size: 0 }))).rejects.toMatchObject({
      actualBytes: 0,
      reason: 'empty-file',
      stage: 'validate-bytes',
    });
  });

  it('rejects a picker-reported size mismatch', async () => {
    await expect(readSelectedBackupFile(selectedFile(nativeFile(), {
      size: validBackupBytes.length + 1,
    }))).rejects.toMatchObject({
      actualBytes: validBackupBytes.length,
      reason: 'size-mismatch',
      stage: 'validate-bytes',
    });
  });

  it('accepts a valid backup when the picker does not report a size', async () => {
    await expect(readSelectedBackupFile(selectedFile(nativeFile(), { size: null }))).resolves.toMatchObject({
      actualBytes: validBackupBytes.length,
      bytes: validBackupBytes,
      magicMatches: true,
    });
  });

  it('rejects bytes without Rainproof magic before container inspection', async () => {
    const invalidBytes = new Uint8Array(validBackupBytes.length).fill(65);
    const file = nativeFile({ bytes: jest.fn(async () => invalidBytes) });

    await expect(readSelectedBackupFile(selectedFile(file))).rejects.toMatchObject({
      actualBytes: invalidBytes.length,
      magicMatches: false,
      reason: 'invalid-magic',
      stage: 'validate-bytes',
    });
  });

  it.each([
    { password: 'test password', protectionMode: 'password' as const },
    { password: '', protectionMode: 'none' as const },
  ])(
    'round-trips a generated $protectionMode container through the native FileSystem picker',
    async ({ password, protectionMode }) => {
      const backup = buildRainproofBackup(minimalSnapshot(), '2026-07-16T08:00:00.000Z');
      const container = await createRainproofBackupContainer(
        backup,
        password,
        password === ''
          ? undefined
          : {
              salt: new Uint8Array(16).fill(7),
              nonce: new Uint8Array(24).fill(9),
            },
      );
      const file = nativeFile({
        bytes: jest.fn(async () => container),
        size: container.length,
      });
      const selected = await pickBackupFileForPlatform(
        'android',
        pickerDependencies({ nativeFile: file }),
      );
      const result = await readSelectedBackupFile(selected!);

      expect(selected?.file).toBe(file);
      expect(result.bytes).toEqual(container);
      expect(inspectRainproofBackup(result.bytes).protectionMode).toBe(protectionMode);
      await expect(validateRainproofBackup(result.bytes, password)).resolves.toEqual(backup);
    },
  );
});

type TestNativeFile = ReadableBackupFile & {
  base64: jest.Mock<Promise<string>, []>;
  name: string;
  type: string;
  uri: string;
};

function nativeFile(overrides: Partial<TestNativeFile> = {}): TestNativeFile {
  return {
    base64: jest.fn(async () => 'unused'),
    bytes: jest.fn(async () => validBackupBytes),
    exists: true,
    name: 'selected.rainproof',
    size: validBackupBytes.length,
    type: 'application/octet-stream',
    uri: 'content://selected.rainproof',
    ...overrides,
  };
}

type PickerOptions = {
  browserFile?: globalThis.File;
  nativeCanceled?: boolean;
  nativeError?: Error;
  nativeFile?: TestNativeFile;
  webCanceled?: boolean;
};

function pickerDependencies({
  browserFile,
  nativeCanceled = false,
  nativeError,
  nativeFile: selectedNativeFile = nativeFile(),
  webCanceled = false,
}: PickerOptions = {}): Required<BackupPickerDependencies> {
  return {
    pickNativeFile: jest.fn(async () => {
      if (nativeError) {
        throw nativeError;
      }
      return nativeCanceled
        ? { canceled: true as const, result: null }
        : { canceled: false as const, result: selectedNativeFile as unknown as File };
    }),
    pickWebFile: jest.fn(async () => {
      if (webCanceled) {
        return { canceled: true as const, assets: null };
      }
      const file = browserFile ?? ({
        arrayBuffer: jest.fn(async () => validBackupBytes.slice().buffer),
        name: 'selected.rainproof',
        size: validBackupBytes.length,
        type: 'application/octet-stream',
      } as unknown as globalThis.File);
      return {
        assets: [{
          file,
          lastModified: 0,
          mimeType: file.type,
          name: file.name,
          size: file.size,
          uri: 'blob:selected',
        }],
        canceled: false as const,
      };
    }),
  };
}

function selectedFile(
  file: TestNativeFile,
  overrides: Partial<Omit<SelectedBackupFile, 'file'>> = {},
): SelectedBackupFile {
  return {
    file,
    mimeType: file.type,
    name: file.name,
    pickerMethod: 'file-system',
    size: file.size,
    uri: file.uri,
    ...overrides,
  };
}

function minimalSnapshot(): AppSnapshot {
  const now = '2026-07-16T00:00:00.000Z';
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
      name: 'Test account',
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
      name: 'Test fund',
      currencyCode: 'AUD',
      goalMinor: 0,
      linkedAccountIds: [],
      createdAt: now,
      updatedAt: now,
    },
  };
}
