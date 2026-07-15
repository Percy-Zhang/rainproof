import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FormError } from '../../components/ui';
import type { AppSnapshot, TransactionLinkBatchInput } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { ExpenseLinkManager } from './ExpenseLinkManager';
import { IncomeLinkManager } from './IncomeLinkManager';
import type { TransactionLinkManagerHandle } from './TransactionLinkFlowViews';

type LinkTransactionScreenProps = {
  initialDraftChanges?: TransactionLinkBatchInput;
  snapshot: AppSnapshot;
  transactionId: string;
  onAcceptTransactionLinkDraft: (input: TransactionLinkBatchInput) => void;
  onBack: () => void;
  showHeader?: boolean;
};

export function LinkTransactionScreen({
  initialDraftChanges,
  snapshot,
  transactionId,
  onAcceptTransactionLinkDraft,
  onBack,
  showHeader = true,
}: LinkTransactionScreenProps) {
  const [error, setError] = useState('');
  const [stageTitle, setStageTitle] = useState('Links');
  const managerRef = useRef<TransactionLinkManagerHandle>(null);
  const transaction = snapshot.transactions.find((item) => item.id === transactionId);
  const handleBack = useCallback(() => {
    if (managerRef.current?.handleBack()) return;
    const draftChanges = managerRef.current?.getDraftChanges();
    if (draftChanges) onAcceptTransactionLinkDraft(draftChanges);
    onBack();
  }, [onAcceptTransactionLinkDraft, onBack]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBack();
      return true;
    });
    return () => subscription.remove();
  }, [handleBack]);

  return (
    <View style={styles.screen}>
      {showHeader ? (
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={handleBack}
            style={styles.backIconButton}
          >
            <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.title}>{stageTitle}</Text>
          <View style={styles.headerPlaceholder} />
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={spacing.xl}
        style={styles.keyboardPane}
      >
        <View style={styles.managerPane}>
          {!transaction ? (
            <Text style={styles.emptyText}>Transaction not found.</Text>
          ) : transaction.kind === 'income' ? (
            <IncomeLinkManager
              ref={managerRef}
              initialDraftChanges={initialDraftChanges}
              snapshot={snapshot}
              transaction={transaction}
              onError={setError}
              onStageTitleChange={setStageTitle}
            />
          ) : transaction.kind === 'expense' ? (
            <ExpenseLinkManager
              ref={managerRef}
              initialDraftChanges={initialDraftChanges}
              snapshot={snapshot}
              transaction={transaction}
              onError={setError}
              onStageTitleChange={setStageTitle}
            />
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transfers cannot be linked.</Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <FormError message={error} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, gap: spacing.sm },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 44,
  },
  backIconButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingRight: spacing.sm,
    width: 88,
  },
  backButtonText: { color: colors.primaryDark, fontSize: typography.body, fontWeight: '800' },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.h3,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerPlaceholder: { width: 88 },
  keyboardPane: { flex: 1 },
  managerPane: { flex: 1 },
  footer: { gap: spacing.sm },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  emptyText: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
});
