import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AccountIconBadge } from '../../components/AccountDisplay';
import { CategoryIconBadge } from '../../components/CategoryDisplay';
import { getAccountDisplayName, getTransparentColor } from '../../domain/accountThemes';
import { getFilteredTransactionItemNameSuggestions } from '../../domain/transactionItemSuggestions';
import type { Account } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

export type NativePickerMode = 'date' | 'time';

const placeholderColor = `${colors.muted}99`;

export function SelectorRow({
  label,
  value,
  onPress,
  color,
  icon,
  iconColor,
  iconKind = 'category',
  empty = false,
}: {
  label: string;
  value: string;
  onPress: () => void;
  color: string;
  icon?: string;
  iconColor?: string;
  iconKind?: 'account' | 'category';
  empty?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectorRow,
        {
          backgroundColor: empty ? colors.surface : getTint(color),
          borderColor: empty ? colors.faint : color,
        },
        pressed && styles.pressed,
      ]}
    >
      {icon ? (
        iconKind === 'account' ? (
          <AccountIconBadge color={iconColor ?? color} iconName={icon} size="sm" />
        ) : (
          <CategoryIconBadge color={iconColor ?? color} icon={icon} size="sm" />
        )
      ) : null}
      <View style={styles.selectorTextBlock}>
        <Text style={styles.selectorLabel}>{label}</Text>
        <Text numberOfLines={1} style={[styles.selectorValue, empty && styles.emptyValue]}>{value}</Text>
      </View>
    </Pressable>
  );
}

export function AutocompleteField({
  label,
  value,
  onChange,
  placeholder,
  suggestions,
  onSelectSuggestion,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suggestions: string[];
  onSelectSuggestion?: (suggestion: string) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <InlineField label={label} value={value} onChange={onChange} placeholder={placeholder} />
      {suggestions.length ? (
        <View style={styles.suggestionRow}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              accessibilityRole="button"
              onPress={() => (onSelectSuggestion ? onSelectSuggestion(suggestion) : onChange(suggestion))}
              style={({ pressed }) => [styles.suggestionChip, pressed && styles.pressed]}
            >
              <Text numberOfLines={1} style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function InlineField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  rightLabel,
  selectAllOnFocus = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
  rightLabel?: string;
  selectAllOnFocus?: boolean;
}) {
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
  const isEmpty = !value.trim();

  return (
    <View style={styles.fieldBlock}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {rightLabel ? <Text style={styles.fieldRightLabel}>{rightLabel}</Text> : null}
      </View>
      <View style={styles.inputFrame}>
        <TextInput
          keyboardType={keyboardType}
          value={value}
          onChangeText={(nextValue) => {
            setSelection(undefined);
            onChange(nextValue);
          }}
          onFocus={() => {
            if (selectAllOnFocus) {
              setSelection({ start: 0, end: value.length });
            }
          }}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          selection={selection}
          style={styles.inlineInput}
        />
        <View pointerEvents="none" style={[styles.inputBorderOverlay, isEmpty && styles.inputBorderOverlayEmpty]} />
      </View>
    </View>
  );
}

export function DateTimePickerFields({
  dateValue,
  timeValue,
  onPressDate,
  onPressTime,
}: {
  dateValue: string;
  timeValue: string;
  onPressDate: () => void;
  onPressTime: () => void;
}) {
  return (
    <View style={styles.dateTimeRow}>
      <NativePickerRow label="Date" value={dateValue} onPress={onPressDate} />
      <NativePickerRow label="Time" value={timeValue} onPress={onPressTime} />
    </View>
  );
}

export function NativePickerRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View style={styles.dateTimeCell}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.nativePickerRow, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={styles.nativePickerValue}>{value}</Text>
      </Pressable>
    </View>
  );
}

export function useAutocompleteOptions(values: string[], query: string): string[] {
  return useMemo(() => {
    return getFilteredTransactionItemNameSuggestions(values, query);
  }, [values, query]);
}

export function accountLabel(account: Account, showCurrencyCodes: boolean): string {
  return showCurrencyCodes ? `${getAccountDisplayName(account)} (${account.currencyCode})` : getAccountDisplayName(account);
}

export function getNativePickerValue(dateValue: string, timeValue: string): Date {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function getNativePickerDisplay(mode: NativePickerMode): 'calendar' | 'clock' | 'compact' {
  if (Platform.OS === 'ios') {
    return 'compact';
  }

  return mode === 'date' ? 'calendar' : 'clock';
}

function getTint(color: string): string {
  return getTransparentColor(color, '22');
}

const styles = StyleSheet.create({
  fieldBlock: {
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  inputFrame: {
    borderRadius: 8,
    position: 'relative',
  },
  inlineInput: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  inputBorderOverlay: {
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  inputBorderOverlayEmpty: {
    opacity: 0.75,
  },
  fieldLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fieldRightLabel: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  suggestionChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    maxWidth: 150,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  suggestionText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '800',
  },
  nativePickerRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  nativePickerValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'center',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dateTimeCell: {
    flex: 1,
    gap: spacing.xs,
  },
  selectorRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectorTextBlock: {
    flex: 1,
    gap: spacing.xs,
  },
  selectorLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  selectorValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '800',
  },
  emptyValue: {
    color: colors.muted,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.78,
  },
});
