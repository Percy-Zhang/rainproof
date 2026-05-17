import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  createCurrencySearchIndex,
  filterCurrencySearchOptions,
  type CurrencyOption,
  type CurrencySearchOption,
} from '../domain/currencyCatalog';
import type { CurrencyCode } from '../domain/types';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { ActionButton, TextField } from './ui';

type CurrencyDropdownProps = {
  label: string;
  value: CurrencyCode;
  options: CurrencyOption[];
  onChange: (currencyCode: CurrencyCode) => void;
  testID?: string;
};

export function CurrencyDropdown({
  label,
  value,
  options,
  onChange,
  testID,
}: CurrencyDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchOptions = useMemo(() => createCurrencySearchIndex(options), [options]);
  const selectedOption = options.find((option) => option.code === value);
  const filteredOptions = useMemo(
    () => filterCurrencySearchOptions(searchOptions, query),
    [query, searchOptions],
  );

  function selectOption(option: CurrencySearchOption) {
    onChange(option.code);
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        testID={testID}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <View style={styles.triggerText}>
          <Text style={styles.valueText}>{selectedOption?.code ?? value}</Text>
          <Text style={styles.detailText}>
            {selectedOption ? `${selectedOption.symbol} ${selectedOption.label}` : 'Choose currency'}
          </Text>
        </View>
        <Text style={styles.chevron}>v</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetTitleText}>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Text style={styles.detailText}>Search by code or currency name.</Text>
              </View>
              <ActionButton variant="ghost" onPress={() => setOpen(false)}>
                Close
              </ActionButton>
            </View>

            <TextField label="Search" value={query} onChangeText={setQuery} placeholder="AUD, Australian dollar" />

            <FlatList
              data={filteredOptions}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(option) => option.code}
              contentContainerStyle={styles.options}
              initialNumToRender={20}
              maxToRenderPerBatch={24}
              windowSize={8}
              ListEmptyComponent={<Text style={styles.emptyText}>No matching currency.</Text>}
              renderItem={({ item: option }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => selectOption(option)}
                  style={({ pressed }) => [
                    styles.option,
                    option.code === value && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.optionText}>
                    <Text style={styles.optionCode}>{option.code}</Text>
                    <Text style={styles.detailText}>{option.label}</Text>
                  </View>
                  <Text style={styles.optionSymbol}>{option.symbol}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  trigger: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  triggerText: {
    flex: 1,
    gap: spacing.xs,
  },
  valueText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  detailText: {
    color: colors.muted,
    fontSize: typography.small,
  },
  chevron: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  overlay: {
    backgroundColor: 'rgba(15, 47, 70, 0.32)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    gap: spacing.md,
    maxHeight: '82%',
    padding: spacing.lg,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  sheetTitleText: {
    flex: 1,
    gap: spacing.xs,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  options: {
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: '700',
    padding: spacing.md,
    textAlign: 'center',
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  optionSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  optionText: {
    flex: 1,
    gap: spacing.xs,
  },
  optionCode: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  optionSymbol: {
    color: colors.primaryDark,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
