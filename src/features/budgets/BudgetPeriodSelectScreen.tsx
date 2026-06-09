import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { budgetPeriodOptions } from '../../domain/budgets';
import type { BudgetPeriod } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

type BudgetPeriodSelectScreenProps = {
  onBack: () => void;
  onSelect: (period: BudgetPeriod) => void;
  selectedPeriod: BudgetPeriod;
};

export function BudgetPeriodSelectScreen({
  onBack,
  onSelect,
  selectedPeriod,
}: BudgetPeriodSelectScreenProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          testID="cancel-budget-period-select"
        >
          <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
        <Text numberOfLines={1} style={styles.title}>Budget period</Text>
        <View style={styles.rightSlot} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <PeriodGroup
          label="Calendar periods"
          selectedPeriod={selectedPeriod}
          onSelect={onSelect}
          periods={budgetPeriodOptions.filter((option) => option.group === 'calendar')}
        />
        <PeriodGroup
          label="Rolling periods"
          selectedPeriod={selectedPeriod}
          onSelect={onSelect}
          periods={budgetPeriodOptions.filter((option) => option.group === 'rolling')}
        />
      </ScrollView>
    </View>
  );
}

function PeriodGroup({
  label,
  onSelect,
  periods,
  selectedPeriod,
}: {
  label: string;
  onSelect: (period: BudgetPeriod) => void;
  periods: typeof budgetPeriodOptions;
  selectedPeriod: BudgetPeriod;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.options}>
        {periods.map((option) => {
          const selected = option.value === selectedPeriod;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [
                styles.option,
                selected && styles.optionSelected,
                pressed && styles.pressed,
              ]}
              testID={`budget-period-option-${option.value}`}
            >
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{option.label}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={21}
                color={selected ? colors.primaryDark : colors.muted}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingRight: spacing.xs,
    width: 84,
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  group: {
    gap: spacing.sm,
  },
  groupLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  list: {
    flexGrow: 1,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionDescription: {
    color: colors.muted,
    fontSize: typography.small,
    lineHeight: 18,
  },
  optionSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  optionText: {
    flex: 1,
    gap: spacing.xs,
  },
  optionTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  options: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.78,
  },
  rightSlot: {
    width: 84,
  },
  screen: {
    flex: 1,
    gap: spacing.md,
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.h2,
    fontWeight: '900',
    textAlign: 'center',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 44,
  },
});
