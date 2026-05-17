import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';

export type CalculatorKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | '/'
  | '*'
  | '-'
  | '+'
  | '='
  | 'backspace';

const calculatorRows: CalculatorKey[][] = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['.', '0', 'backspace', '+'],
];

export function TransactionCalculator({ onPressKey }: { onPressKey: (key: CalculatorKey) => void }) {
  return (
    <View style={styles.calculatorSection}>
      <View style={styles.calculatorGrid}>
        {calculatorRows.map((row) => (
          <View key={row.join('')} style={styles.calculatorRow}>
            {row.map((key) => (
              <CalculatorButton key={key} value={key} onPress={() => onPressKey(key)} />
            ))}
          </View>
        ))}
        <View style={styles.calculatorRow}>
          <View style={styles.calculatorButtonSpacer} />
          <View style={styles.calculatorButtonSpacer} />
          <View style={styles.calculatorButtonSpacer} />
          <CalculatorButton value="=" onPress={() => onPressKey('=')} />
        </View>
      </View>
    </View>
  );
}

function CalculatorButton({ value, onPress }: { value: CalculatorKey; onPress: () => void }) {
  const isEquals = value === '=';
  const isBackspace = value === 'backspace';

  return (
    <Pressable
      accessibilityLabel={isBackspace ? 'Backspace' : undefined}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.calculatorButton,
        isOperatorKey(value) && styles.operatorButton,
        isEquals && styles.equalsButton,
        pressed && styles.pressed,
      ]}
    >
      {isBackspace ? (
        <Ionicons name="backspace-outline" size={22} color={colors.ink} />
      ) : (
        <Text style={[styles.calculatorButtonText, isEquals && styles.equalsButtonText]}>{value}</Text>
      )}
    </Pressable>
  );
}

function isOperatorKey(value: string): boolean {
  return value === '+' || value === '-' || value === '*' || value === '/';
}

const styles = StyleSheet.create({
  calculatorSection: {
    marginTop: 'auto',
  },
  calculatorGrid: {
    gap: spacing.xs,
  },
  calculatorRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  calculatorButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 58,
  },
  calculatorButtonSpacer: {
    flex: 1,
    minHeight: 58,
  },
  operatorButton: {
    backgroundColor: '#F4FAFF',
  },
  equalsButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  calculatorButtonText: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  equalsButtonText: {
    color: colors.surface,
  },
  pressed: {
    opacity: 0.78,
  },
});
