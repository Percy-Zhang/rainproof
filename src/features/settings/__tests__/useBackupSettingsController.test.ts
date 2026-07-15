import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  BackupReadError,
  createRainproofBackupContainerFromSnapshot,
  inspectRainproofBackup,
  validateRainproofBackup,
} from '../../../domain/backupContainer';
import { buildRainproofBackup } from '../../../domain/backupExport';
import type { AppSnapshot } from '../../../domain/types';
import {
  BackupFilePickerError,
  readSelectedBackupFile,
  type BackupSettingsServices,
  type ReadableBackupFile,
  type SelectedBackupFile,
} from '../backupSettingsServices';
import { useBackupSettingsController } from '../useBackupSettingsController';

jest.mock('../../../domain/backupContainer', () => {
  const actual = jest.requireActual('../../../domain/backupContainer');
  return {
    ...actual,
    createRainproofBackupContainerFromSnapshot: jest.fn(),
    inspectRainproofBackup: jest.fn(),
    validateRainproofBackup: jest.fn(),
  };
});

const mockedCreateContainer = jest.mocked(createRainproofBackupContainerFromSnapshot);
const mockedInspectBackup = jest.mocked(inspectRainproofBackup);
const mockedValidateBackup = jest.mocked(validateRainproofBackup);
const exportedAt = '2026-07-14T10:42:00.000Z';
const selectedBackupBytes = new Uint8Array([
  ...Buffer.from('RNPF0002', 'ascii'),
  0,
  0,
  0,
  0,
]);

describe('useBackupSettingsController', () => {
  let frameCallbacks: FrameRequestCallback[];
  let originalRequestAnimationFrame: typeof requestAnimationFrame;
  let originalCancelAnimationFrame: typeof cancelAnimationFrame;

  beforeEach(() => {
    frameCallbacks = [];
    originalRequestAnimationFrame = global.requestAnimationFrame;
    originalCancelAnimationFrame = global.cancelAnimationFrame;
    global.requestAnimationFrame = jest.fn((callback: FrameRequestCallback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    global.cancelAnimationFrame = jest.fn();
    mockedCreateContainer.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockedInspectBackup.mockReturnValue(inspection('none'));
    mockedValidateBackup.mockResolvedValue(buildRainproofBackup(snapshot(), exportedAt));
  });

  afterEach(() => {
    global.requestAnimationFrame = originalRequestAnimationFrame;
    global.cancelAnimationFrame = originalCancelAnimationFrame;
    jest.clearAllMocks();
  });

  it('allows dismissal outside active backup work', () => {
    const { result } = renderController();

    act(() => {
      result.current.openExportFlow();
      result.current.closeFlow();
    });
    expect(result.current.flow).toEqual({ kind: 'idle' });
    expect(result.current.isBackupOperationActive).toBe(false);

    act(() => {
      result.current.openRestoreFlow();
      result.current.closeFlow();
    });
    expect(result.current.flow).toEqual({ kind: 'idle' });
  });

  it('preserves exact passwords, blocks mismatches, and skips the unencrypted warning', async () => {
    const { result } = renderController();

    act(() => {
      result.current.openExportFlow();
      result.current.setExportPassword(' pass ');
      result.current.setExportPasswordConfirmation('pass');
      result.current.submitExport();
    });
    expect(result.current.flow).toMatchObject({
      kind: 'export',
      phase: 'editing',
      error: "Passwords don't match.",
    });

    act(() => {
      result.current.setExportPasswordConfirmation(' pass ');
      result.current.submitExport();
    });
    expect(result.current.flow).toMatchObject({
      kind: 'export',
      phase: 'exporting',
      progress: { operation: 'export', stage: 'build-snapshot', percentage: 4 },
    });
    expect(result.current.isBackupOperationActive).toBe(true);
    act(() => result.current.closeFlow());
    expect(result.current.flow).toMatchObject({ kind: 'export', phase: 'exporting' });
    expect(mockedCreateContainer).not.toHaveBeenCalled();

    await flushFrames(3);
    await waitFor(() => expect(result.current.flow.kind).toBe('idle'));
    expect(mockedCreateContainer).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      ' pass ',
      expect.objectContaining({ salt: expect.any(Uint8Array), nonce: expect.any(Uint8Array) }),
      expect.any(Object),
    );
    expect(result.current.backupStatus).toBe('Backup created.');
  });

  it.each([
    ['password', ''],
    ['', 'password'],
  ])('blocks export when only one password field is blank', (password, confirmation) => {
    const { result } = renderController();

    act(() => {
      result.current.openExportFlow();
      result.current.setExportPassword(password);
      result.current.setExportPasswordConfirmation(confirmation);
      result.current.toggleExportPasswordVisibility();
      result.current.submitExport();
    });

    expect(result.current.flow).toMatchObject({
      kind: 'export',
      phase: 'editing',
      password,
      confirmation,
      passwordVisible: true,
      error: "Passwords don't match.",
    });
    expect(mockedCreateContainer).not.toHaveBeenCalled();
  });

  it('requires one confirmation for blank export and guards duplicate confirmation taps', async () => {
    const { result, services } = renderController();

    act(() => {
      result.current.openExportFlow();
      result.current.submitExport();
    });
    expect(result.current.flow).toMatchObject({ kind: 'export', phase: 'confirming-unencrypted' });
    expect(mockedCreateContainer).not.toHaveBeenCalled();

    act(() => result.current.cancelUnencryptedExport());
    expect(result.current.flow).toMatchObject({ kind: 'export', phase: 'editing' });

    act(() => {
      result.current.submitExport();
      result.current.confirmUnencryptedExport();
      result.current.confirmUnencryptedExport();
    });
    expect(result.current.flow).toMatchObject({ kind: 'export', phase: 'exporting' });

    await flushFrames(3);
    await waitFor(() => expect(result.current.flow.kind).toBe('idle'));
    expect(mockedCreateContainer).toHaveBeenCalledTimes(1);
    expect(mockedCreateContainer).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      '',
      undefined,
      expect.any(Object),
    );
    expect(services.writeBackupFile).toHaveBeenCalledTimes(1);
    expect(services.writeBackupFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.rainproof$/),
      expect.any(Uint8Array),
    );
    expect(services.shareBackupFile).toHaveBeenCalledTimes(1);
    expect(services.shareBackupFile).toHaveBeenCalledWith('file://written-backup');
  });

  it('exits progress and returns to an editable export after a failure', async () => {
    mockedCreateContainer.mockRejectedValueOnce(new Error('compression failed'));
    const { result, services } = renderController();

    act(() => {
      result.current.openExportFlow();
      result.current.setExportPassword('pass');
      result.current.setExportPasswordConfirmation('pass');
      result.current.submitExport();
    });
    expect(result.current.flow).toMatchObject({ kind: 'export', phase: 'exporting' });

    await flushNextFrame();
    await waitFor(() => expect(result.current.flow).toMatchObject({
      kind: 'export',
      phase: 'editing',
      progress: null,
      error: "Couldn't create the backup. Try again.",
    }));
    expect(services.writeBackupFile).not.toHaveBeenCalled();
    expect(services.shareBackupFile).not.toHaveBeenCalled();
  });

  it('keeps selected metadata available after a wrong password and allows retry', async () => {
    const backup = buildRainproofBackup(snapshot(), exportedAt);
    mockedInspectBackup.mockReturnValue(inspection('password'));
    mockedValidateBackup
      .mockRejectedValueOnce(new BackupReadError('incorrect_password_or_corrupt_backup'))
      .mockResolvedValueOnce(backup);
    const { result, services } = renderController();

    act(() => result.current.openRestoreFlow());
    expect(result.current.flow).toMatchObject({ kind: 'restore', phase: 'selecting' });
    await flushFrames(3);
    await waitFor(() => expect(result.current.flow).toMatchObject({ kind: 'restore', phase: 'file-selected' }));
    expect(services.readBackupFile).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: 'application/octet-stream',
      name: 'selected.rainproof',
      pickerMethod: 'file-system',
      size: selectedBackupBytes.length,
      uri: 'content://selected',
    }));

    act(() => {
      result.current.setRestorePassword('wrong');
      result.current.validateSelectedBackup();
    });
    expect(result.current.flow).toMatchObject({
      kind: 'restore',
      phase: 'validating',
      progress: { operation: 'validation', stage: 'parse-container', percentage: 10 },
    });
    expect(result.current.isBackupOperationActive).toBe(true);
    act(() => result.current.closeFlow());
    expect(result.current.flow).toMatchObject({ kind: 'restore', phase: 'validating' });
    await flushNextFrame();
    await waitFor(() => expect(result.current.flow).toMatchObject({
      kind: 'restore',
      phase: 'file-selected',
      error: 'Incorrect password or invalid backup.',
      password: 'wrong',
      selectedFileName: 'selected.rainproof',
    }));

    act(() => {
      result.current.setRestorePassword('correct');
      result.current.validateSelectedBackup();
    });
    await flushFrames(2);
    await waitFor(() => expect(result.current.flow).toMatchObject({ kind: 'restore', phase: 'preview' }));
    expect(mockedValidateBackup).toHaveBeenNthCalledWith(
      1,
      expect.any(Uint8Array),
      'wrong',
      expect.any(Object),
    );
    expect(mockedValidateBackup).toHaveBeenNthCalledWith(
      2,
      expect.any(Uint8Array),
      'correct',
      expect.any(Object),
    );
  });

  it('requires explicit restore confirmation and guards duplicate restore taps', async () => {
    const onRestoreBackup = jest.fn(async () => undefined);
    const { result } = renderController(onRestoreBackup);
    await reachRestorePreview(result);

    expect(onRestoreBackup).not.toHaveBeenCalled();
    act(() => result.current.requestRestoreConfirmation());
    expect(result.current.flow).toMatchObject({ kind: 'restore', phase: 'confirming' });
    act(() => result.current.cancelRestoreConfirmation());
    expect(result.current.flow).toMatchObject({ kind: 'restore', phase: 'preview' });

    act(() => {
      result.current.requestRestoreConfirmation();
      result.current.confirmRestore();
      result.current.confirmRestore();
    });
    expect(result.current.flow).toMatchObject({ kind: 'restore', phase: 'restoring' });
    expect(result.current.isBackupOperationActive).toBe(true);
    act(() => result.current.closeFlow());
    expect(result.current.flow).toMatchObject({ kind: 'restore', phase: 'restoring' });
    expect(onRestoreBackup).not.toHaveBeenCalled();

    await flushNextFrame();
    await waitFor(() => expect(result.current.flow.kind).toBe('idle'));
    expect(onRestoreBackup).toHaveBeenCalledTimes(1);
    expect(result.current.backupStatus).toBe('Backup restored.');
  });

  it('returns to the validated preview with a friendly error when restore fails', async () => {
    const onRestoreBackup = jest.fn(async () => {
      throw new Error('raw storage failure');
    });
    const { result } = renderController(onRestoreBackup);
    await reachRestorePreview(result);

    act(() => {
      result.current.requestRestoreConfirmation();
      result.current.confirmRestore();
    });
    await flushNextFrame();
    await waitFor(() => expect(result.current.flow).toMatchObject({
      kind: 'restore',
      phase: 'preview',
      error: "Couldn't restore the backup. Your current data was not changed.",
    }));
  });

  it('maps unsupported selected files to a friendly retryable error', async () => {
    mockedInspectBackup.mockImplementation(() => {
      throw new BackupReadError('unsupported_format');
    });
    const { result } = renderController();

    act(() => result.current.openRestoreFlow());
    await flushFrames(3);
    await waitFor(() => expect(result.current.flow).toMatchObject({
      kind: 'restore',
      phase: 'file-error',
      error: "This backup isn't supported.",
    }));
  });

  it('treats picker cancellation as a no-op without reading or inspecting', async () => {
    const pickBackupFile = jest.fn(async () => null);
    const { result, services } = renderController(jest.fn(async () => undefined), {
      pickBackupFile,
    });

    act(() => result.current.openRestoreFlow());
    await flushNextFrame();

    await waitFor(() => expect(result.current.flow).toEqual({ kind: 'idle' }));
    expect(pickBackupFile).toHaveBeenCalledTimes(1);
    expect(services.readBackupFile).not.toHaveBeenCalled();
    expect(mockedInspectBackup).not.toHaveBeenCalled();
  });

  it('shows a concise error when the FileSystem picker fails', async () => {
    const pickerError = new BackupFilePickerError(
      'file-system',
      Object.assign(new Error('native picker failure'), { code: 'ERR_PICKER' }),
    );
    const { result, services } = renderController(jest.fn(async () => undefined), {
      pickBackupFile: jest.fn(async () => { throw pickerError; }),
    });

    act(() => result.current.openRestoreFlow());
    await flushNextFrame();

    await waitFor(() => expect(result.current.flow).toMatchObject({
      kind: 'restore',
      phase: 'file-error',
      error: "Couldn't open the selected backup.",
    }));
    expect(services.readBackupFile).not.toHaveBeenCalled();
    expect(mockedInspectBackup).not.toHaveBeenCalled();
  });

  it('does not inspect or fall back when the selected File bytes read fails', async () => {
    const selected = selectedBackupFile({
      bytes: jest.fn(async () => {
        throw Object.assign(new Error('read failed'), { code: 'ERR_INVALID_PERMISSION' });
      }),
    });
    const readBackupFile = jest.fn(readSelectedBackupFile);
    const { result } = renderController(jest.fn(async () => undefined), {
      pickBackupFile: jest.fn(async () => selected),
      readBackupFile,
    });

    act(() => result.current.openRestoreFlow());
    await flushFrames(2);

    await waitFor(() => expect(result.current.flow).toMatchObject({
      kind: 'restore',
      phase: 'file-error',
      error: "Couldn't read the selected backup.",
    }));
    expect(readBackupFile).toHaveBeenCalledTimes(1);
    expect(mockedInspectBackup).not.toHaveBeenCalled();
  });

  it('reaches password entry after reading the FileSystem picker File directly', async () => {
    mockedInspectBackup.mockReturnValue(inspection('password'));
    const selected = selectedBackupFile();
    const readBackupFile = jest.fn(readSelectedBackupFile);
    const { result } = renderController(jest.fn(async () => undefined), {
      pickBackupFile: jest.fn(async () => selected),
      readBackupFile,
    });

    act(() => result.current.openRestoreFlow());
    await flushFrames(3);

    await waitFor(() => expect(result.current.flow).toMatchObject({
      kind: 'restore',
      phase: 'file-selected',
      pendingBackup: {
        inspection: { protectionMode: 'password' },
      },
    }));
    expect(readBackupFile).toHaveBeenCalledTimes(1);
    expect(selected.file.bytes).toHaveBeenCalledTimes(1);
  });

  async function reachRestorePreview(result: ReturnType<typeof renderController>['result']) {
    act(() => result.current.openRestoreFlow());
    await flushFrames(3);
    await waitFor(() => expect(result.current.flow).toMatchObject({ kind: 'restore', phase: 'file-selected' }));
    act(() => result.current.validateSelectedBackup());
    await flushFrames(2);
    await waitFor(() => expect(result.current.flow).toMatchObject({ kind: 'restore', phase: 'preview' }));
  }

  async function flushNextFrame() {
    const callback = frameCallbacks.shift();
    expect(callback).toBeDefined();
    await act(async () => {
      callback?.(0);
      await Promise.resolve();
    });
  }

  async function flushFrames(count: number) {
    for (let index = 0; index < count; index += 1) {
      await flushNextFrame();
    }
  }
});

function renderController(
  onRestoreBackup = jest.fn(async () => undefined),
  overrides: Partial<BackupSettingsServices> = {},
) {
  const selected = selectedBackupFile();
  const services: BackupSettingsServices = {
    getRandomBytes: jest.fn(async (length) => new Uint8Array(length).fill(7)),
    pickBackupFile: jest.fn(async () => selected),
    readBackupFile: jest.fn(async () => ({
      actualBytes: selectedBackupBytes.length,
      bytes: selectedBackupBytes,
      fileExists: true,
      fileSize: selectedBackupBytes.length,
      magicMatches: true as const,
      pickerMethod: 'file-system' as const,
    })),
    writeBackupFile: jest.fn(async () => 'file://written-backup'),
    shareBackupFile: jest.fn(async () => undefined),
    ...overrides,
  };
  const hook = renderHook(() => useBackupSettingsController({
    snapshot: snapshot(),
    onRestoreBackup,
    services,
  }));
  return { ...hook, services };
}

function selectedBackupFile(
  fileOverrides: Partial<ReadableBackupFile> = {},
): SelectedBackupFile {
  const file: ReadableBackupFile = {
    bytes: jest.fn(async () => selectedBackupBytes),
    exists: true,
    size: selectedBackupBytes.length,
    ...fileOverrides,
  };
  return {
    file,
    mimeType: 'application/octet-stream',
    name: 'selected.rainproof',
    pickerMethod: 'file-system',
    size: selectedBackupBytes.length,
    uri: 'content://selected',
  };
}

function inspection(protectionMode: 'none' | 'password') {
  return {
    createdAt: exportedAt,
    appVersion: '1.0.0',
    formatVersion: 1,
    backupFormatVersion: 1,
    protectionMode,
  } as const;
}

function snapshot(): AppSnapshot {
  const now = '2026-07-14T00:00:00.000Z';
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
