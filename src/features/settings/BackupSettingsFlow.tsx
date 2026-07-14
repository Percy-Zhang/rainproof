import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ActionButton, FormError } from '../../components/ui';
import { colors, radii, spacing, typography } from '../../theme/tokens';
import type {
  BackupFlowState,
  BackupSettingsController,
  PendingBackupFile,
} from './useBackupSettingsController';
import type { BackupWorkProgress } from './backupWorkProgress';

type BackupSettingsFlowProps = {
  controller: BackupSettingsController;
};

export function BackupSettingsFlow({ controller }: BackupSettingsFlowProps) {
  const { flow } = controller;
  if (flow.kind === 'idle') {
    return null;
  }

  const title = flow.kind === 'export' ? 'Export backup' : 'Restore backup';

  return (
    <Modal
      allowSwipeDismissal={!controller.isBackupOperationActive}
      animationType="fade"
      onRequestClose={controller.closeFlow}
      transparent
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable
          accessible={false}
          disabled={controller.isBackupOperationActive}
          onPress={controller.closeFlow}
          style={styles.backdrop}
        />
        <View accessibilityViewIsModal style={styles.flowCard}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            {!controller.isBackupOperationActive ? (
              <Pressable
                accessibilityLabel="Close backup flow"
                accessibilityRole="button"
                hitSlop={8}
                onPress={controller.closeFlow}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <Ionicons name="close" color={colors.primaryDark} size={22} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {flow.kind === 'export' ? (
              <ExportFlow controller={controller} flow={flow} />
            ) : (
              <RestoreFlow controller={controller} flow={flow} />
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ExportFlow({
  controller,
  flow,
}: BackupSettingsFlowProps & {
  flow: Extract<BackupFlowState, { kind: 'export' }>;
}) {
  if (flow.phase === 'exporting') {
    return (
      <LoadingState
        detail="Keep Rainproof open while the file is prepared."
        fallbackLabel="Preparing backup..."
        progress={flow.progress}
        title="Creating backup"
      />
    );
  }

  if (flow.phase === 'confirming-unencrypted') {
    return (
      <View style={styles.section}>
        <Text style={styles.stepTitle}>Export without a password?</Text>
        <Text style={styles.bodyText}>
          This backup will not be encrypted. Anyone with access to the file may be able to read its contents.
        </Text>
        <View style={styles.actionRow}>
          <View style={styles.actionCell}>
            <ActionButton onPress={controller.cancelUnencryptedExport} variant="secondary">
              Cancel
            </ActionButton>
          </View>
          <View style={styles.actionCell}>
            <ActionButton onPress={controller.confirmUnencryptedExport} testID="confirm-unencrypted-export">
              Export anyway
            </ActionButton>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.bodyText}>
        Add a password to protect this file, or leave both fields blank for an unencrypted backup.
      </Text>
      <PasswordInput
        label="Password (optional)"
        onChangeText={controller.setExportPassword}
        onToggleVisibility={controller.toggleExportPasswordVisibility}
        testID="backup-export-password"
        visibilityTestID="backup-export-password-visibility"
        value={flow.password}
        visible={flow.passwordVisible}
      />
      <PasswordInput
        label="Confirm password"
        onChangeText={controller.setExportPasswordConfirmation}
        onSubmitEditing={controller.submitExport}
        onToggleVisibility={controller.toggleExportPasswordVisibility}
        testID="backup-export-password-confirmation"
        visibilityTestID="backup-export-confirmation-visibility"
        value={flow.confirmation}
        visible={flow.passwordVisible}
      />
      <Text style={styles.guidance}>{"Use a password you'll remember. Rainproof cannot recover it."}</Text>
      <Text style={styles.guidance}>Leaving the password blank creates an unencrypted backup.</Text>
      <FormError message={flow.error} />
      <ActionButton onPress={controller.submitExport} testID="submit-backup-export">
        Export backup
      </ActionButton>
    </View>
  );
}

function RestoreFlow({
  controller,
  flow,
}: BackupSettingsFlowProps & {
  flow: Extract<BackupFlowState, { kind: 'restore' }>;
}) {
  if (flow.phase === 'selecting') {
    return (
      <LoadingState
        fallbackLabel="Opening file picker..."
        title="Choose a backup"
      />
    );
  }
  if (flow.phase === 'inspecting') {
    return (
      <LoadingState
        detail={flow.selectedFileName || undefined}
        fallbackLabel="Checking backup..."
        progress={flow.progress}
        title="Checking backup"
      />
    );
  }
  if (flow.phase === 'file-error') {
    return (
      <View style={styles.section}>
        <FormError message={flow.error} />
        <ActionButton onPress={controller.chooseAnotherBackup} variant="secondary">
          Choose another backup
        </ActionButton>
      </View>
    );
  }
  if (flow.phase === 'validating') {
    return (
      <View style={styles.section}>
        <SelectedBackupMetadata pendingBackup={flow.pendingBackup} />
        <LoadingState
          fallbackLabel="Checking backup..."
          progress={flow.progress}
          title="Checking backup"
        />
      </View>
    );
  }
  if (flow.phase === 'preview' || flow.phase === 'confirming' || flow.phase === 'restoring') {
    return <RestorePreview controller={controller} flow={flow} />;
  }

  return (
    <View style={styles.section}>
      <SelectedBackupMetadata pendingBackup={flow.pendingBackup} />
      {flow.pendingBackup?.inspection.protectionMode === 'password' ? (
        <>
          <PasswordInput
            label="Password"
            onChangeText={controller.setRestorePassword}
            onSubmitEditing={controller.validateSelectedBackup}
            onToggleVisibility={controller.toggleRestorePasswordVisibility}
            testID="backup-restore-password"
            visibilityTestID="backup-restore-password-visibility"
            value={flow.password}
            visible={flow.passwordVisible}
          />
        </>
      ) : null}
      <FormError message={flow.error} />
      <ActionButton onPress={controller.validateSelectedBackup} testID="validate-selected-backup">
        Continue
      </ActionButton>
      <ActionButton onPress={controller.chooseAnotherBackup} variant="secondary">
        Choose another backup
      </ActionButton>
    </View>
  );
}

function RestorePreview({
  controller,
  flow,
}: BackupSettingsFlowProps & {
  flow: Extract<BackupFlowState, { kind: 'restore' }>;
}) {
  const preview = flow.preview;
  if (!preview) {
    return <FormError message="This backup is damaged or invalid." />;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.stepTitle}>Ready to restore</Text>
      <MetadataPanel>
        <MetadataRow label="Created" value={formatBackupDate(preview.createdAt)} />
        <MetadataRow label="Accounts" value={formatCount(preview.counts.accounts)} />
        <MetadataRow label="Transactions" value={formatCount(preview.counts.transactions)} />
        <MetadataRow label="Budgets" value={formatCount(preview.counts.budgets)} />
        <MetadataRow label="Categories" value={formatCount(preview.counts.categories)} />
        <MetadataRow label="Upcoming payments" value={formatCount(preview.counts.upcomingPayments)} />
      </MetadataPanel>
      <View style={styles.warningPanel}>
        <Ionicons name="warning-outline" color={colors.danger} size={20} />
        <Text style={styles.warningText}>
          Restoring will replace your current Rainproof data with this backup.
        </Text>
      </View>
      <FormError message={flow.error} />
      {flow.phase === 'restoring' ? (
        <LoadingState
          fallbackLabel="Restoring backup..."
          progress={flow.progress}
          title="Restoring backup"
        />
      ) : flow.phase === 'confirming' ? (
        <View style={styles.actionRow}>
          <View style={styles.actionCell}>
            <ActionButton onPress={controller.cancelRestoreConfirmation} variant="secondary">
              Cancel
            </ActionButton>
          </View>
          <View style={styles.actionCell}>
            <ActionButton
              onPress={controller.confirmRestore}
              testID="confirm-backup-restore"
              variant="danger"
            >
              Restore
            </ActionButton>
          </View>
        </View>
      ) : (
        <>
          <ActionButton onPress={controller.requestRestoreConfirmation} testID="review-backup-restore">
            Review restore
          </ActionButton>
          <ActionButton onPress={controller.chooseAnotherBackup} variant="secondary">
            Choose another backup
          </ActionButton>
        </>
      )}
    </View>
  );
}

function SelectedBackupMetadata({ pendingBackup }: { pendingBackup: PendingBackupFile | null }) {
  if (!pendingBackup) {
    return null;
  }
  const { inspection } = pendingBackup;
  return (
    <View style={styles.section}>
      <View style={styles.selectedFile}>
        <Ionicons name="document-outline" color={colors.primaryDark} size={20} />
        <View style={styles.selectedFileText}>
          <Text style={styles.stepTitle}>Selected backup</Text>
          <Text numberOfLines={2} style={styles.filename}>{pendingBackup.name}</Text>
        </View>
      </View>
      <MetadataPanel>
        <MetadataRow label="Created" value={formatBackupDate(inspection.createdAt)} />
        <MetadataRow
          label="Protection"
          value={inspection.protectionMode === 'password' ? 'Password protected' : 'Not password protected'}
        />
        <MetadataRow label="App version" value={inspection.appVersion} />
        <MetadataRow label="Backup format" value={String(inspection.backupFormatVersion)} />
      </MetadataPanel>
    </View>
  );
}

function MetadataPanel({ children }: { children: React.ReactNode }) {
  return <View style={styles.metadataPanel}>{children}</View>;
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metadataRow}>
      <Text style={styles.metadataLabel}>{label}</Text>
      <Text selectable style={styles.metadataValue}>{value}</Text>
    </View>
  );
}

function PasswordInput({
  label,
  onChangeText,
  onSubmitEditing,
  onToggleVisibility,
  testID,
  visibilityTestID,
  value,
  visible,
}: {
  label: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: () => void;
  onToggleVisibility: () => void;
  testID: string;
  visibilityTestID: string;
  value: string;
  visible: boolean;
}) {
  const initialAndroidValueRef = useRef(value);
  const textValueProps = Platform.OS === 'android'
    ? { defaultValue: initialAndroidValueRef.current }
    : { value };

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.passwordInputShell}>
        <TextInput
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={onSubmitEditing ? 'done' : 'next'}
          secureTextEntry={!visible}
          selectionColor={colors.primary}
          spellCheck={false}
          style={styles.passwordInput}
          testID={testID}
          {...textValueProps}
        />
        <Pressable
          accessibilityLabel={visible ? 'Hide backup password' : 'Show backup password'}
          accessibilityRole="button"
          hitSlop={4}
          onPress={onToggleVisibility}
          style={({ pressed }) => [styles.passwordVisibilityButton, pressed && styles.pressed]}
          testID={visibilityTestID}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            color={colors.primaryDark}
            size={19}
          />
        </Pressable>
      </View>
    </View>
  );
}

function LoadingState({
  detail,
  fallbackLabel,
  progress,
  title,
}: {
  detail?: string;
  fallbackLabel: string;
  progress?: BackupWorkProgress | null;
  title: string;
}) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.loadingState}>
      <Text style={styles.stepTitle}>{title}</Text>
      <View style={styles.loadingRow} testID="backup-loading-state">
        <ActivityIndicator
          accessible={false}
          color={colors.primaryDark}
          size="small"
          testID="backup-activity-indicator"
        />
        <Text style={styles.loadingText}>{progress?.label ?? fallbackLabel}</Text>
      </View>
      {detail ? <Text style={styles.guidance}>{detail}</Text> : null}
    </View>
  );
}

function formatBackupDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(15, 47, 70, 0.36)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.md,
  },
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  flowCard: {
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderColor: colors.faint,
    borderRadius: radii.lg,
    borderWidth: 1,
    elevation: 8,
    maxHeight: '92%',
    maxWidth: 680,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.faint,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.h2,
    fontWeight: '900',
    minWidth: 0,
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: radii.sm,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  content: {
    padding: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  stepTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  bodyText: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: 22,
  },
  guidance: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  field: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  passwordInput: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.body,
    minHeight: 48,
    minWidth: 0,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
  },
  passwordInputShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    overflow: 'hidden',
  },
  passwordVisibilityButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 48,
    width: 48,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionCell: {
    flex: 1,
    minWidth: 132,
  },
  metadataPanel: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: radii.sm,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  metadataRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  metadataLabel: {
    color: colors.muted,
    flexShrink: 0,
    fontSize: typography.small,
    fontWeight: '700',
    lineHeight: 18,
    width: 116,
  },
  metadataValue: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '800',
    lineHeight: 18,
    minWidth: 0,
    textAlign: 'right',
  },
  selectedFile: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  selectedFileText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  filename: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  warningPanel: {
    alignItems: 'flex-start',
    backgroundColor: '#FCEEEE',
    borderColor: colors.danger,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  warningText: {
    color: colors.danger,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '700',
    lineHeight: 18,
    minWidth: 0,
  },
  loadingState: {
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 104,
    paddingVertical: spacing.lg,
  },
  loadingText: {
    color: colors.ink,
    flexShrink: 1,
    fontSize: typography.body,
    fontWeight: '800',
    lineHeight: 22,
    minWidth: 0,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    maxWidth: '100%',
    width: '100%',
  },
  pressed: {
    opacity: 0.76,
  },
});
