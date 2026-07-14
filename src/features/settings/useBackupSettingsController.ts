import { useEffect, useRef, useState } from 'react';

import {
  BackupReadError,
  createRainproofBackupContainerFromSnapshot,
  inspectRainproofBackup,
  validateRainproofBackup,
  type BackupContainerObserver,
  type BackupStageTiming,
  type RainproofBackupInspection,
} from '../../domain/backupContainer';
import {
  buildBackupRestorePreview,
  getRainproofBackupFilename,
  type BackupRestorePreview,
  type BackupRestoreProgressReporter,
  type RainproofBackup,
} from '../../domain/backupExport';
import type { AppSnapshot } from '../../domain/types';
import { logDevPerfDuration, logDevPerfMeasurement } from '../../performance';
import {
  defaultBackupSettingsServices,
  type BackupSettingsServices,
  type SelectedBackupFile,
} from './backupSettingsServices';
import {
  getBackupWorkProgress,
  getContainerWorkProgress,
  mergeBackupWorkProgress,
  type BackupWorkProgress,
} from './backupWorkProgress';

type UseBackupSettingsControllerInput = {
  snapshot: AppSnapshot;
  onRestoreBackup: (
    backup: RainproofBackup,
    onProgress?: BackupRestoreProgressReporter,
  ) => Promise<void>;
  services?: BackupSettingsServices;
};

export type PendingBackupFile = {
  bytes: Uint8Array;
  name: string;
  inspection: RainproofBackupInspection;
};

export type BackupFlowState =
  | { kind: 'idle' }
  | {
      kind: 'export';
      phase: 'editing' | 'confirming-unencrypted' | 'exporting';
      password: string;
      confirmation: string;
      passwordVisible: boolean;
      progress: BackupWorkProgress | null;
      error: string;
    }
  | {
      kind: 'restore';
      phase:
        | 'selecting'
        | 'inspecting'
        | 'file-error'
        | 'file-selected'
        | 'validating'
        | 'preview'
        | 'confirming'
        | 'restoring';
      selectedFileName: string;
      pendingBackup: PendingBackupFile | null;
      password: string;
      passwordVisible: boolean;
      validatedBackup: RainproofBackup | null;
      preview: BackupRestorePreview | null;
      progress: BackupWorkProgress | null;
      error: string;
    };

export function useBackupSettingsController({
  snapshot,
  onRestoreBackup,
  services = defaultBackupSettingsServices,
}: UseBackupSettingsControllerInput) {
  const [flow, setFlowState] = useState<BackupFlowState>({ kind: 'idle' });
  const [backupStatus, setBackupStatus] = useState('');
  const flowRef = useRef<BackupFlowState>(flow);
  const operationTokenRef = useRef(0);
  const operationBusyRef = useRef(false);
  const scheduledFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      operationTokenRef.current += 1;
      if (scheduledFrameRef.current !== null) {
        cancelAnimationFrame(scheduledFrameRef.current);
      }
    };
  }, []);

  function setFlow(nextFlow: BackupFlowState) {
    flowRef.current = nextFlow;
    setFlowState(nextFlow);
  }

  function openExportFlow() {
    if (operationBusyRef.current) {
      return;
    }
    setBackupStatus('');
    setFlow(createExportFlow());
  }

  function openRestoreFlow() {
    if (operationBusyRef.current) {
      return;
    }
    setBackupStatus('');
    startBackupSelection();
  }

  function closeFlow() {
    if (isActiveBackupOperation(flowRef.current)) {
      return;
    }
    operationTokenRef.current += 1;
    operationBusyRef.current = false;
    setFlow({ kind: 'idle' });
  }

  function setExportPassword(value: string) {
    const current = flowRef.current;
    if (current.kind !== 'export' || current.phase !== 'editing') {
      return;
    }
    setFlow({ ...current, password: value, error: '' });
  }

  function setExportPasswordConfirmation(value: string) {
    const current = flowRef.current;
    if (current.kind !== 'export' || current.phase !== 'editing') {
      return;
    }
    setFlow({ ...current, confirmation: value, error: '' });
  }

  function toggleExportPasswordVisibility() {
    const current = flowRef.current;
    if (current.kind !== 'export' || current.phase !== 'editing') {
      return;
    }
    setFlow({ ...current, passwordVisible: !current.passwordVisible });
  }

  function submitExport() {
    const current = flowRef.current;
    if (current.kind !== 'export' || current.phase !== 'editing' || operationBusyRef.current) {
      return;
    }
    const passwordError = getExportPasswordError(current.password, current.confirmation);
    if (passwordError) {
      setFlow({ ...current, error: passwordError });
      return;
    }
    if (current.password === '') {
      setFlow({ ...current, phase: 'confirming-unencrypted', error: '' });
      return;
    }
    startExport(current);
  }

  function cancelUnencryptedExport() {
    const current = flowRef.current;
    if (current.kind !== 'export' || current.phase !== 'confirming-unencrypted') {
      return;
    }
    setFlow({ ...current, phase: 'editing' });
  }

  function confirmUnencryptedExport() {
    const current = flowRef.current;
    if (current.kind !== 'export' || current.phase !== 'confirming-unencrypted') {
      return;
    }
    startExport(current);
  }

  function startExport(current: Extract<BackupFlowState, { kind: 'export' }>) {
    const token = beginOperation();
    if (token === null) {
      return;
    }
    const startedAt = Date.now();
    const passwordProtected = current.password !== '';
    setFlow({
      ...current,
      phase: 'exporting',
      progress: getContainerWorkProgress('export', 'build-snapshot', passwordProtected),
      error: '',
    });
    scheduleAfterPaint(token, async () => {
      try {
        const exportedAt = new Date().toISOString();
        const randomness = current.password === ''
          ? undefined
          : {
              salt: await services.getRandomBytes(16),
              nonce: await services.getRandomBytes(24),
            };
        const observer = createContainerObserver(token, passwordProtected);
        const container = await createRainproofBackupContainerFromSnapshot(
          snapshot,
          exportedAt,
          current.password,
          randomness,
          observer,
        );
        await reportProgressAndPaint(
          token,
          getBackupWorkProgress('export', 'write-file'),
        );
        const writeStartedAt = Date.now();
        const backupUri = await services.writeBackupFile(
          getRainproofBackupFilename(exportedAt),
          container,
        );
        logDevPerfDuration('backup.export.write-file', writeStartedAt, {
          outputBytes: container.length,
        });
        await reportProgressAndPaint(
          token,
          getBackupWorkProgress('export', 'share-file'),
        );
        const shareStartedAt = Date.now();
        await services.shareBackupFile(backupUri);
        logDevPerfDuration('backup.export.share-file', shareStartedAt);
        if (!isCurrentOperation(token)) {
          return;
        }
        setBackupStatus('Backup created.');
        setFlow({ kind: 'idle' });
      } catch {
        if (!isCurrentOperation(token)) {
          return;
        }
        setFlow({
          ...current,
          phase: 'editing',
          progress: null,
          error: "Couldn't create the backup. Try again.",
        });
      } finally {
        logDevPerfDuration('backup.export.total', startedAt, { passwordProtected });
        finishOperation(token);
      }
    });
  }

  function startBackupSelection() {
    const token = beginOperation();
    if (token === null) {
      return;
    }
    setFlow({
      ...createRestoreFlow('selecting'),
      progress: getBackupWorkProgress('inspection', 'read-file'),
    });
    scheduleAfterPaint(token, async () => {
      try {
        const selected = await services.pickBackupFile();
        if (!isCurrentOperation(token)) {
          return;
        }
        if (!selected) {
          setFlow({ kind: 'idle' });
          return;
        }
        await inspectSelectedBackup(selected, token);
      } catch (error) {
        if (!isCurrentOperation(token)) {
          return;
        }
        setFlow({
          ...createRestoreFlow('file-error'),
          error: getBackupErrorMessage(error, "Couldn't open the selected backup."),
        });
      } finally {
        finishOperation(token);
      }
    });
  }

  async function inspectSelectedBackup(selected: SelectedBackupFile, token: number) {
    setFlow({
      ...createRestoreFlow('inspecting'),
      selectedFileName: selected.name,
      progress: getBackupWorkProgress('inspection', 'read-file'),
    });
    try {
      await waitForNextPaint(token);
      if (!isCurrentOperation(token)) {
        return;
      }
      const readStartedAt = Date.now();
      const bytes = await services.readBackupFile(selected.uri);
      logDevPerfDuration('backup.inspection.read-file', readStartedAt, {
        inputBytes: bytes.length,
      });
      if (!isCurrentOperation(token)) {
        return;
      }
      await reportProgressAndPaint(
        token,
        getBackupWorkProgress('inspection', 'inspect-file'),
      );
      const inspectStartedAt = Date.now();
      const inspection = inspectRainproofBackup(bytes);
      logDevPerfDuration('backup.inspection.inspect-file', inspectStartedAt, {
        inputBytes: bytes.length,
        passwordProtected: inspection.protectionMode === 'password',
      });
      setFlow({
        ...createRestoreFlow('file-selected'),
        selectedFileName: selected.name,
        pendingBackup: { bytes, name: selected.name, inspection },
      });
    } catch (error) {
      if (!isCurrentOperation(token)) {
        return;
      }
      setFlow({
        ...createRestoreFlow('file-error'),
        selectedFileName: selected.name,
        error: getBackupErrorMessage(error, "Couldn't open the selected backup."),
      });
    }
  }

  function chooseAnotherBackup() {
    if (operationBusyRef.current) {
      return;
    }
    startBackupSelection();
  }

  function setRestorePassword(value: string) {
    const current = flowRef.current;
    if (current.kind !== 'restore' || current.phase !== 'file-selected') {
      return;
    }
    setFlow({ ...current, password: value, error: '' });
  }

  function toggleRestorePasswordVisibility() {
    const current = flowRef.current;
    if (current.kind !== 'restore' || current.phase !== 'file-selected') {
      return;
    }
    setFlow({ ...current, passwordVisible: !current.passwordVisible });
  }

  function validateSelectedBackup() {
    const current = flowRef.current;
    if (
      current.kind !== 'restore'
      || current.phase !== 'file-selected'
      || !current.pendingBackup
      || operationBusyRef.current
    ) {
      return;
    }
    const pendingBackup = current.pendingBackup;
    if (current.pendingBackup.inspection.protectionMode === 'password' && current.password === '') {
      setFlow({ ...current, error: 'Enter the password for this backup.' });
      return;
    }

    const token = beginOperation();
    if (token === null) {
      return;
    }
    const startedAt = Date.now();
    const passwordProtected = pendingBackup.inspection.protectionMode === 'password';
    setFlow({
      ...current,
      phase: 'validating',
      progress: getContainerWorkProgress('validation', 'parse-container', passwordProtected),
      error: '',
    });
    scheduleAfterPaint(token, async () => {
      try {
        const backup = await validateRainproofBackup(
          pendingBackup.bytes,
          passwordProtected ? current.password : '',
          createContainerObserver(token, passwordProtected),
        );
        if (!isCurrentOperation(token)) {
          return;
        }
        await reportProgressAndPaint(
          token,
          getBackupWorkProgress('validation', 'preview'),
        );
        const previewStartedAt = Date.now();
        const preview = buildBackupRestorePreview(backup);
        logDevPerfDuration('backup.validation.preview', previewStartedAt);
        setFlow({
          ...current,
          phase: 'preview',
          validatedBackup: backup,
          preview,
          progress: null,
          error: '',
        });
      } catch (error) {
        if (!isCurrentOperation(token)) {
          return;
        }
        setFlow({
          ...current,
          phase: 'file-selected',
          progress: null,
          error: getBackupErrorMessage(error, 'This backup is damaged or invalid.'),
        });
      } finally {
        logDevPerfDuration('backup.validation.total', startedAt, {
          inputBytes: pendingBackup.bytes.length,
          passwordProtected,
        });
        finishOperation(token);
      }
    });
  }

  function requestRestoreConfirmation() {
    const current = flowRef.current;
    if (current.kind !== 'restore' || current.phase !== 'preview' || !current.validatedBackup) {
      return;
    }
    setFlow({ ...current, phase: 'confirming', error: '' });
  }

  function cancelRestoreConfirmation() {
    const current = flowRef.current;
    if (current.kind !== 'restore' || current.phase !== 'confirming') {
      return;
    }
    setFlow({ ...current, phase: 'preview' });
  }

  function confirmRestore() {
    const current = flowRef.current;
    if (
      current.kind !== 'restore'
      || current.phase !== 'confirming'
      || !current.validatedBackup
      || operationBusyRef.current
    ) {
      return;
    }
    const validatedBackup = current.validatedBackup;

    const token = beginOperation();
    if (token === null) {
      return;
    }
    const startedAt = Date.now();
    setFlow({
      ...current,
      phase: 'restoring',
      progress: getBackupWorkProgress('restore', 'prepare-restore'),
      error: '',
    });
    scheduleAfterPaint(token, async () => {
      try {
        await onRestoreBackup(validatedBackup, async (stage) => {
          await reportProgressAndPaint(token, getBackupWorkProgress('restore', stage));
        });
        if (!isCurrentOperation(token)) {
          return;
        }
        setBackupStatus('Backup restored.');
        setFlow({ kind: 'idle' });
      } catch {
        if (!isCurrentOperation(token)) {
          return;
        }
        setFlow({
          ...current,
          phase: 'preview',
          progress: null,
          error: "Couldn't restore the backup. Your current data was not changed.",
        });
      } finally {
        logDevPerfDuration('backup.restore.total', startedAt);
        finishOperation(token);
      }
    });
  }

  function beginOperation(): number | null {
    if (operationBusyRef.current) {
      return null;
    }
    operationBusyRef.current = true;
    operationTokenRef.current += 1;
    return operationTokenRef.current;
  }

  function finishOperation(token: number) {
    if (operationTokenRef.current === token) {
      operationBusyRef.current = false;
    }
  }

  function isCurrentOperation(token: number): boolean {
    return mountedRef.current && operationTokenRef.current === token;
  }

  function createContainerObserver(
    token: number,
    passwordProtected: boolean,
  ): BackupContainerObserver {
    let passwordWorkStartedAt: number | null = null;
    return {
      async onStageStart(operation, stage) {
        await reportProgressAndPaint(
          token,
          getContainerWorkProgress(operation, stage, passwordProtected),
        );
        if (stage === 'derive-key') {
          passwordWorkStartedAt = Date.now();
        }
      },
      onStageComplete(timing) {
        logBackupStageTiming(timing, passwordProtected);
        const passwordWorkComplete = timing.status === 'error'
          || (timing.operation === 'export' && timing.stage === 'build-container')
          || (timing.operation === 'validation' && timing.stage === 'decrypt');
        if (passwordWorkStartedAt !== null && passwordWorkComplete) {
          logDevPerfMeasurement(
            timing.operation === 'export'
              ? 'backup.export.protect-total'
              : 'backup.validation.unlock-total',
            Date.now() - passwordWorkStartedAt,
            { passwordProtected, status: timing.status },
          );
          passwordWorkStartedAt = null;
        }
      },
    };
  }

  async function reportProgressAndPaint(token: number, next: BackupWorkProgress) {
    if (!isCurrentOperation(token)) {
      return;
    }
    const current = flowRef.current;
    if (current.kind === 'idle') {
      return;
    }
    setFlow({
      ...current,
      progress: mergeBackupWorkProgress(current.progress, next),
    });
    await waitForNextPaint(token);
  }

  function waitForNextPaint(token: number): Promise<void> {
    return new Promise((resolve) => {
      if (!isCurrentOperation(token)) {
        resolve();
        return;
      }
      scheduledFrameRef.current = requestAnimationFrame(() => {
        scheduledFrameRef.current = null;
        resolve();
      });
    });
  }

  function scheduleAfterPaint(token: number, task: () => Promise<void>) {
    scheduledFrameRef.current = requestAnimationFrame(() => {
      scheduledFrameRef.current = null;
      if (isCurrentOperation(token)) {
        void task();
      }
    });
  }

  return {
    backupStatus,
    cancelRestoreConfirmation,
    cancelUnencryptedExport,
    chooseAnotherBackup,
    closeFlow,
    confirmRestore,
    confirmUnencryptedExport,
    flow,
    isBackupOperationActive: isActiveBackupOperation(flow),
    isBackupBusy: isBusyFlow(flow),
    openExportFlow,
    openRestoreFlow,
    requestRestoreConfirmation,
    setExportPassword,
    setExportPasswordConfirmation,
    setRestorePassword,
    submitExport,
    toggleExportPasswordVisibility,
    toggleRestorePasswordVisibility,
    validateSelectedBackup,
  };
}

export type BackupSettingsController = ReturnType<typeof useBackupSettingsController>;

export function getExportPasswordError(password: string, confirmation: string): string {
  return password === confirmation ? '' : "Passwords don't match.";
}

function createExportFlow(): Extract<BackupFlowState, { kind: 'export' }> {
  return {
    kind: 'export',
    phase: 'editing',
    password: '',
    confirmation: '',
    passwordVisible: false,
    progress: null,
    error: '',
  };
}

function createRestoreFlow(
  phase: Extract<BackupFlowState, { kind: 'restore' }>['phase'],
): Extract<BackupFlowState, { kind: 'restore' }> {
  return {
    kind: 'restore',
    phase,
    selectedFileName: '',
    pendingBackup: null,
    password: '',
    passwordVisible: false,
    validatedBackup: null,
    preview: null,
    progress: null,
    error: '',
  };
}

function logBackupStageTiming(timing: BackupStageTiming, passwordProtected: boolean) {
  logDevPerfMeasurement(
    `backup.${timing.operation}.${timing.stage}`,
    timing.durationMs,
    {
      inputBytes: timing.inputBytes,
      outputBytes: timing.outputBytes,
      passwordProtected,
      status: timing.status,
    },
  );
}

function isBusyFlow(flow: BackupFlowState): boolean {
  return (flow.kind === 'export' && flow.phase === 'exporting')
    || (flow.kind === 'restore' && [
      'selecting',
      'inspecting',
      'validating',
      'restoring',
    ].includes(flow.phase));
}

function isActiveBackupOperation(flow: BackupFlowState): boolean {
  return (flow.kind === 'export' && flow.phase === 'exporting')
    || (flow.kind === 'restore' && ['validating', 'restoring'].includes(flow.phase));
}

function getBackupErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof BackupReadError)) {
    return fallback;
  }
  switch (error.code) {
    case 'unsupported_format':
      return "This backup isn't supported.";
    case 'incorrect_password_or_corrupt_backup':
      return 'Incorrect password or invalid backup.';
    case 'invalid_backup':
      return 'This backup is damaged or invalid.';
    case 'password_required':
      return 'Enter the password for this backup.';
  }
}
