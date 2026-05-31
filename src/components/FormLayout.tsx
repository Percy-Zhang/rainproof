import { Ionicons } from '@expo/vector-icons';
import type { PropsWithChildren } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CategoryIconBadge } from './CategoryDisplay';
import type { Account } from '../domain/types';
import { colors, spacing, typography } from '../theme/tokens';

type FormScreenShellProps = PropsWithChildren<{
  onBack: () => void;
  onSave: () => void;
  saveLabel?: string;
  saveTestID?: string;
  title: string;
}>;

export function FormScreenShell({
  children,
  onBack,
  onSave,
  saveLabel = 'Save',
  saveTestID,
  title,
}: FormScreenShellProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primaryDark} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onSave}
          style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed]}
          testID={saveTestID}
        >
          <Text style={styles.confirmText}>{saveLabel}</Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}

export function KeyboardAwareFormScroll({
  children,
  contentContainerStyle,
  style,
}: PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
}>) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={style}
    >
      {children}
    </ScrollView>
  );
}

export function FormSection({
  children,
  label,
  style,
}: PropsWithChildren<{
  label?: string;
  style?: StyleProp<ViewStyle>;
}>) {
  return (
    <View style={[styles.fieldGroup, style]}>
      {label ? <FormLabel>{label}</FormLabel> : null}
      {children}
    </View>
  );
}

export function FormLabel({ children }: PropsWithChildren) {
  return <Text style={styles.label}>{children}</Text>;
}

export function FormChipRow({ children }: PropsWithChildren) {
  return <View style={styles.wrap}>{children}</View>;
}

export function FormHelperText({ children }: PropsWithChildren) {
  return <Text style={styles.hint}>{children}</Text>;
}

export function ReadonlyField({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <FormSection label={label}>
      <View style={styles.readOnlyField}>
        <Text style={styles.readOnlyValue}>{value}</Text>
        <FormHelperText>{detail}</FormHelperText>
      </View>
    </FormSection>
  );
}

export function AccountOptionList({
  accounts,
  emptyMessage,
  onSelectAccount,
  selectedAccountId,
}: {
  accounts: Account[];
  emptyMessage: string;
  onSelectAccount: (accountId: string) => void;
  selectedAccountId: string;
}) {
  return (
    <View style={styles.optionList}>
      {accounts.length ? (
        accounts.map((account) => (
          <Pressable
            accessibilityRole="button"
            key={account.id}
            onPress={() => onSelectAccount(account.id)}
            style={({ pressed }) => [
              styles.optionRow,
              selectedAccountId === account.id && styles.optionRowSelected,
              pressed && styles.pressed,
            ]}
          >
            <CategoryIconBadge color={account.themeColor} icon={account.iconName} size="sm" />
            <View style={styles.optionText}>
              <Text numberOfLines={1} style={styles.optionTitle}>{account.name}</Text>
              <Text style={styles.optionDetail}>{account.currencyCode}</Text>
            </View>
            {selectedAccountId === account.id ? (
              <Ionicons name="checkmark" size={18} color={colors.primaryDark} />
            ) : null}
          </Pressable>
        ))
      ) : (
        <FormHelperText>{emptyMessage}</FormHelperText>
      )}
    </View>
  );
}

export function FormPreviewRow({
  color,
  detail,
  icon,
  title,
}: {
  color: string;
  detail: string;
  icon: string;
  title: string;
}) {
  return (
    <View style={styles.preview}>
      <CategoryIconBadge color={color} icon={icon} size="md" />
      <View style={styles.previewText}>
        <Text style={styles.previewTitle}>{title}</Text>
        <FormHelperText>{detail}</FormHelperText>
      </View>
    </View>
  );
}

export function FormDangerZone({
  children,
  label,
  warning,
}: PropsWithChildren<{
  label: string;
  warning?: string;
}>) {
  return (
    <View style={styles.dangerZone}>
      <FormLabel>{label}</FormLabel>
      {children}
      {warning ? <Text style={styles.warningText}>{warning}</Text> : null}
    </View>
  );
}

export function FormInlineAction({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.clearActionButton, pressed && styles.pressed]}
    >
      <Text style={styles.clearActionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  clearActionButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    justifyContent: 'center',
  },
  clearActionText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  confirmButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  confirmText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  dangerZone: {
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    gap: spacing.sm,
    marginTop: 'auto',
    paddingTop: spacing.md,
  },
  fieldGroup: {
    gap: spacing.sm,
  },
  hint: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  iconButton: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  label: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  nativePickerDone: {
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  nativePickerDoneText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  nativePickerPanel: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 0,
  },
  optionDetail: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '700',
  },
  optionList: {
    gap: spacing.sm,
  },
  optionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionRowSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  optionText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  optionTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
  preview: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  previewText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  previewTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  readOnlyField: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  readOnlyValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  shell: {
    flex: 1,
  },
  title: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 46,
  },
  warningText: {
    color: colors.danger,
    fontSize: typography.small,
    lineHeight: 18,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});

export const formLayoutStyles = {
  nativePickerDone: styles.nativePickerDone,
  nativePickerDoneText: styles.nativePickerDoneText,
  nativePickerPanel: styles.nativePickerPanel,
  pressed: styles.pressed,
};
