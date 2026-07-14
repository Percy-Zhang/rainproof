import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Modal, Platform } from 'react-native';

import type { RainproofBackupInspection } from '../../../domain/backupContainer';
import type { BackupRestorePreview } from '../../../domain/backupExport';
import type { AppSnapshot } from '../../../domain/types';
import { BackupSettingsFlow } from '../BackupSettingsFlow';
import { SettingsScreen } from '../SettingsScreen';
import type {
  BackupFlowState,
  BackupSettingsController,
  PendingBackupFile,
} from '../useBackupSettingsController';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

describe('BackupSettingsFlow', () => {
  it('keeps Settings compact until the user chooses a backup action', () => {
    const screen = render(React.createElement(SettingsScreen, {
      snapshot: snapshot(),
      onOpenCategoryManagement: jest.fn(),
      onRestoreBackup: jest.fn(async () => undefined),
      onUpdateSettings: jest.fn(async () => undefined),
    }));

    expect(screen.getByText('Backup & restore')).toBeTruthy();
    expect(screen.getByTestId('export-rainproof-backup')).toBeTruthy();
    expect(screen.getByTestId('restore-rainproof-backup')).toBeTruthy();
    expect(screen.queryByTestId('backup-export-password')).toBeNull();

    fireEvent.press(screen.getByTestId('export-rainproof-backup'));
    expect(screen.getByTestId('backup-export-password')).toBeTruthy();
    expect(screen.getByTestId('backup-export-password-confirmation')).toBeTruthy();
  });

  it('renders native secure fields with two in-field controls sharing visibility state', () => {
    const controller = createController({
      kind: 'export',
      phase: 'editing',
      password: ' pass ',
      confirmation: ' pass ',
      passwordVisible: false,
      progress: null,
      error: '',
    });
    const screen = render(React.createElement(BackupSettingsFlow, { controller }));

    const password = screen.getByTestId('backup-export-password');
    const confirmation = screen.getByTestId('backup-export-password-confirmation');
    expect(password.props.value).toBe(' pass ');
    expect(confirmation.props.value).toBe(' pass ');
    expect(password.props.secureTextEntry).toBe(true);
    expect(password.props.autoCapitalize).toBe('none');
    expect(password.props.autoCorrect).toBe(false);
    expect(password.props.spellCheck).toBe(false);

    const visibilityControls = screen.getAllByLabelText('Show backup password');
    expect(visibilityControls).toHaveLength(2);
    expect(screen.queryByText('Show')).toBeNull();

    fireEvent.press(screen.getByTestId('backup-export-password-visibility'));
    fireEvent.press(screen.getByTestId('backup-export-confirmation-visibility'));
    expect(controller.toggleExportPasswordVisibility).toHaveBeenCalledTimes(2);

    const visibleController = createController({
      ...controller.flow,
      passwordVisible: true,
    } as Extract<BackupFlowState, { kind: 'export' }>);
    screen.rerender(React.createElement(BackupSettingsFlow, { controller: visibleController }));
    expect(screen.getByTestId('backup-export-password').props.secureTextEntry).toBe(false);
    expect(screen.getByTestId('backup-export-password-confirmation').props.secureTextEntry).toBe(false);
    expect(screen.getByTestId('backup-export-password').props.value).toBe(' pass ');
    expect(screen.getByTestId('backup-export-password-confirmation').props.value).toBe(' pass ');
    expect(screen.getAllByLabelText('Hide backup password')).toHaveLength(2);
  });

  it('leaves Android password text native-owned without changing the iOS input path', () => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const controller = createController({
      kind: 'export',
      phase: 'editing',
      password: ' exact ',
      confirmation: ' exact ',
      passwordVisible: false,
      progress: null,
      error: '',
    });

    try {
      const screen = render(React.createElement(BackupSettingsFlow, { controller }));
      const password = screen.getByTestId('backup-export-password');

      expect(password.props.defaultValue).toBe(' exact ');
      expect(password.props.value).toBeUndefined();
      expect(password.props.secureTextEntry).toBe(true);
      expect(password.props.key).toBeUndefined();
      fireEvent.changeText(password, ' exact value ');
      expect(controller.setExportPassword).toHaveBeenCalledWith(' exact value ');
      const changedController = createController({
        ...controller.flow,
        password: ' exact value ',
      } as Extract<BackupFlowState, { kind: 'export' }>);
      screen.rerender(React.createElement(BackupSettingsFlow, { controller: changedController }));
      expect(screen.getByTestId('backup-export-password').props.defaultValue).toBe(' exact ');
      expect(screen.getByTestId('backup-export-password').props.value).toBeUndefined();
      screen.unmount();

      Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
      const iosScreen = render(React.createElement(BackupSettingsFlow, { controller }));
      expect(iosScreen.getByTestId('backup-export-password').props.value).toBe(' exact ');
      expect(iosScreen.getByTestId('backup-export-password').props.defaultValue).toBeUndefined();
      iosScreen.unmount();
    } finally {
      if (platformDescriptor) {
        Object.defineProperty(Platform, 'OS', platformDescriptor);
      }
    }
  });

  it('shows a clear confirmation only for unencrypted export', () => {
    const controller = createController({
      kind: 'export',
      phase: 'confirming-unencrypted',
      password: '',
      confirmation: '',
      passwordVisible: false,
      progress: null,
      error: '',
    });
    const screen = render(React.createElement(BackupSettingsFlow, { controller }));

    expect(screen.getByText('Export without a password?')).toBeTruthy();
    expect(screen.getByText(/will not be encrypted/i)).toBeTruthy();
    fireEvent.press(screen.getByText('Cancel'));
    expect(controller.cancelUnencryptedExport).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByTestId('confirm-unencrypted-export'));
    expect(controller.confirmUnencryptedExport).toHaveBeenCalledTimes(1);
  });

  it('shows safe metadata and a password field only for protected backups', () => {
    const protectedController = createController(fileSelectedFlow('password'));
    const screen = render(React.createElement(BackupSettingsFlow, { controller: protectedController }));

    expect(screen.getByText('Selected backup')).toBeTruthy();
    expect(screen.getByText('Password protected')).toBeTruthy();
    expect(screen.getByText('1.0.0')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByTestId('backup-restore-password')).toBeTruthy();
    expect(screen.getByTestId('backup-restore-password').props.secureTextEntry).toBe(true);
    expect(screen.getByLabelText('Show backup password')).toBeTruthy();
    fireEvent.press(screen.getByTestId('backup-restore-password-visibility'));
    expect(protectedController.toggleRestorePasswordVisibility).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Continue')).toBeTruthy();

    const unencryptedController = createController(fileSelectedFlow('none'));
    screen.rerender(React.createElement(BackupSettingsFlow, { controller: unencryptedController }));
    expect(screen.getByText('Not password protected')).toBeTruthy();
    expect(screen.queryByTestId('backup-restore-password')).toBeNull();
  });

  it('shows preview counts before exposing the destructive Restore action', () => {
    const previewController = createController(previewFlow('preview'));
    const screen = render(React.createElement(BackupSettingsFlow, { controller: previewController }));

    expect(screen.getByText('Ready to restore')).toBeTruthy();
    expect(screen.getByText('1,842')).toBeTruthy();
    expect(screen.getByText('Upcoming payments')).toBeTruthy();
    expect(screen.getByText(/replace your current Rainproof data/i)).toBeTruthy();
    expect(screen.getByTestId('review-backup-restore')).toBeTruthy();
    expect(screen.queryByText('Restore')).toBeNull();

    const confirmingController = createController(previewFlow('confirming'));
    screen.rerender(React.createElement(BackupSettingsFlow, { controller: confirmingController }));
    expect(screen.getByTestId('confirm-backup-restore')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('announces validation and restore work without exposing raw errors', () => {
    const validating = createController({
      ...fileSelectedFlow('none'),
      phase: 'validating',
      progress: {
        operation: 'validation',
        stage: 'decompress',
        label: 'Decompressing backup...',
        percentage: 55,
      },
    });
    const screen = render(React.createElement(BackupSettingsFlow, { controller: validating }));
    expect(screen.getByText('Decompressing backup...')).toBeTruthy();
    expect(screen.getByTestId('backup-activity-indicator')).toBeTruthy();
    expect(screen.queryByText('55%')).toBeNull();
    expect(screen.queryByTestId('backup-progress-bar')).toBeNull();
    expect(screen.queryByTestId('backup-progress-shimmer')).toBeNull();
    expect(screen.queryByLabelText('Close backup flow')).toBeNull();

    const restoring = createController({
      ...previewFlow('restoring'),
      progress: {
        operation: 'restore',
        stage: 'restore-data',
        label: 'Restoring data...',
        percentage: 45,
      },
    });
    screen.rerender(React.createElement(BackupSettingsFlow, { controller: restoring }));
    expect(screen.getByText('Restoring data...')).toBeTruthy();
    expect(screen.getByTestId('backup-activity-indicator')).toBeTruthy();
    expect(screen.queryByText('45%')).toBeNull();
    expect(screen.queryByLabelText('Close backup flow')).toBeNull();
    expect(screen.queryByText(/elapsed|remaining/i)).toBeNull();
  });

  it('shows native loading and blocks modal dismissal only during active backup work', () => {
    const exporting = createController({
      kind: 'export',
      phase: 'exporting',
      password: 'password',
      confirmation: 'password',
      passwordVisible: false,
      progress: {
        operation: 'export',
        stage: 'derive-key',
        label: 'Preparing password protection...',
        percentage: 60,
      },
      error: '',
    });
    const screen = render(React.createElement(BackupSettingsFlow, { controller: exporting }));

    expect(screen.getByTestId('backup-activity-indicator')).toBeTruthy();
    expect(screen.getByText('Preparing password protection...')).toBeTruthy();
    expect(screen.queryByText('60%')).toBeNull();
    expect(screen.queryByTestId('backup-progress-bar')).toBeNull();
    expect(screen.queryByTestId('backup-progress-shimmer')).toBeNull();
    expect(screen.queryByLabelText('Close backup flow')).toBeNull();
    expect(screen.UNSAFE_getByType(Modal).props.allowSwipeDismissal).toBe(false);

    const editing = createController({
      ...exporting.flow,
      phase: 'editing',
      progress: null,
      error: "Couldn't create the backup. Try again.",
    } as Extract<BackupFlowState, { kind: 'export' }>);
    screen.rerender(React.createElement(BackupSettingsFlow, { controller: editing }));
    expect(screen.queryByTestId('backup-activity-indicator')).toBeNull();
    expect(screen.getByLabelText('Close backup flow')).toBeTruthy();
    expect(screen.UNSAFE_getByType(Modal).props.allowSwipeDismissal).toBe(true);

    const previewController = createController(previewFlow('preview'));
    screen.rerender(React.createElement(BackupSettingsFlow, { controller: previewController }));
    expect(screen.queryByTestId('backup-activity-indicator')).toBeNull();
    expect(screen.getByLabelText('Close backup flow')).toBeTruthy();

    const idleController = createController({ kind: 'idle' });
    screen.rerender(React.createElement(BackupSettingsFlow, { controller: idleController }));
    expect(screen.queryByTestId('backup-activity-indicator')).toBeNull();
  });
});

function createController(flow: BackupFlowState): BackupSettingsController {
  return {
    backupStatus: '',
    cancelRestoreConfirmation: jest.fn(),
    cancelUnencryptedExport: jest.fn(),
    chooseAnotherBackup: jest.fn(),
    closeFlow: jest.fn(),
    confirmRestore: jest.fn(),
    confirmUnencryptedExport: jest.fn(),
    flow,
    isBackupOperationActive: isActiveOperation(flow),
    isBackupBusy: isBusy(flow),
    openExportFlow: jest.fn(),
    openRestoreFlow: jest.fn(),
    requestRestoreConfirmation: jest.fn(),
    setExportPassword: jest.fn(),
    setExportPasswordConfirmation: jest.fn(),
    setRestorePassword: jest.fn(),
    submitExport: jest.fn(),
    toggleExportPasswordVisibility: jest.fn(),
    toggleRestorePasswordVisibility: jest.fn(),
    validateSelectedBackup: jest.fn(),
  };
}

function fileSelectedFlow(
  protectionMode: RainproofBackupInspection['protectionMode'],
): Extract<BackupFlowState, { kind: 'restore' }> {
  return {
    kind: 'restore',
    phase: 'file-selected',
    selectedFileName: 'selected.rainproof',
    pendingBackup: pendingBackup(protectionMode),
    password: '',
    passwordVisible: false,
    validatedBackup: null,
    preview: null,
    progress: null,
    error: '',
  };
}

function previewFlow(
  phase: 'preview' | 'confirming' | 'restoring',
): Extract<BackupFlowState, { kind: 'restore' }> {
  return {
    ...fileSelectedFlow('password'),
    phase,
    preview: preview(),
  };
}

function pendingBackup(protectionMode: RainproofBackupInspection['protectionMode']): PendingBackupFile {
  return {
    bytes: new Uint8Array([1]),
    name: 'selected.rainproof',
    inspection: {
      createdAt: '2026-07-14T10:42:00.000Z',
      appVersion: '1.0.0',
      formatVersion: 1,
      backupFormatVersion: 1,
      protectionMode,
    },
  };
}

function preview(): BackupRestorePreview {
  return {
    createdAt: '2026-07-14T10:42:00.000Z',
    appVersion: '1.0.0',
    counts: {
      accounts: 7,
      transactions: 1842,
      budgets: 12,
      categories: 24,
      upcomingPayments: 8,
    },
  };
}

function isBusy(flow: BackupFlowState): boolean {
  return (flow.kind === 'export' && flow.phase === 'exporting')
    || (flow.kind === 'restore' && ['selecting', 'inspecting', 'validating', 'restoring'].includes(flow.phase));
}

function isActiveOperation(flow: BackupFlowState): boolean {
  return (flow.kind === 'export' && flow.phase === 'exporting')
    || (flow.kind === 'restore' && ['validating', 'restoring'].includes(flow.phase));
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
