import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StatsReportKind } from '../../domain/statsReports';
import { colors, spacing, typography } from '../../theme/tokens';

export function StatsReportKindSwitch({
  onSelectReportKind,
  selectedReportKind,
}: {
  onSelectReportKind: (reportKind: StatsReportKind) => void;
  selectedReportKind: StatsReportKind;
}) {
  return (
    <View
      accessibilityLabel="Statistics report mode"
      style={styles.switch}
      testID="stats-report-mode-row"
    >
      {(['expense', 'income'] as const).map((reportKind) => {
        const selected = selectedReportKind === reportKind;
        const label = reportKind === 'expense' ? 'Expenses' : 'Income';

        return (
          <Pressable
            key={reportKind}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelectReportKind(reportKind)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && styles.pressed,
            ]}
            testID={`stats-report-mode-${reportKind}`}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  switch: {
    alignItems: 'stretch',
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 2,
    padding: 2,
  },
  option: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  optionSelected: {
    backgroundColor: colors.primary,
  },
  optionText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  optionTextSelected: {
    color: colors.surface,
  },
  pressed: {
    opacity: 0.78,
  },
});
