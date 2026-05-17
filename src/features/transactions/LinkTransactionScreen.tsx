import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FormError } from '../../components/ui';
import type {
  AppSnapshot,
  NewTransactionLinkInput,
  UpdateTransactionLinkInput,
} from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { ExpenseLinkManager } from './ExpenseLinkManager';
import { IncomeLinkManager } from './IncomeLinkManager';

type LinkTransactionScreenProps = {
  snapshot: AppSnapshot;
  transactionId: string;
  onAddTransactionLink: (input: NewTransactionLinkInput) => Promise<void>;
  onUpdateTransactionLink: (input: UpdateTransactionLinkInput) => Promise<void>;
  onDeleteTransactionLink: (linkId: string) => Promise<void>;
  onBack: () => void;
};

export function LinkTransactionScreen({
  snapshot,
  transactionId,
  onAddTransactionLink,
  onUpdateTransactionLink,
  onDeleteTransactionLink,
  onBack,
}: LinkTransactionScreenProps) {
  const [error, setError] = useState('');
  const transaction = snapshot.transactions.find((item) => item.id === transactionId);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });

    return () => subscription.remove();
  }, [onBack]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backIconButton}>
          <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Link transaction</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={spacing.xl}
        style={styles.keyboardPane}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!transaction ? (
            <Text style={styles.emptyText}>Transaction not found.</Text>
          ) : transaction.kind === 'income' ? (
            <IncomeLinkManager
              snapshot={snapshot}
              transaction={transaction}
              onAddTransactionLink={onAddTransactionLink}
              onUpdateTransactionLink={onUpdateTransactionLink}
              onDeleteTransactionLink={onDeleteTransactionLink}
              onError={setError}
            />
          ) : transaction.kind === 'expense' ? (
            <ExpenseLinkManager
              snapshot={snapshot}
              transaction={transaction}
              onAddTransactionLink={onAddTransactionLink}
              onUpdateTransactionLink={onUpdateTransactionLink}
              onDeleteTransactionLink={onDeleteTransactionLink}
              onError={setError}
            />
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transfers cannot be linked as refunds or reimbursements.</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <FormError message={error} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.sm,
  },
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
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.h3,
    fontWeight: '900',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 88,
  },
  keyboardPane: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.sm,
    paddingBottom: 140,
  },
  footer: {
    gap: spacing.sm,
  },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
});
