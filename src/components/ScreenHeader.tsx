import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';

type ScreenHeaderProps = {
  accessibilityLabel?: string;
  label?: string;
  onBack: () => void;
  testID?: string;
};

export function ScreenHeader({
  accessibilityLabel = 'Back to Dashboard',
  label = 'Dashboard',
  onBack,
  testID = 'back-to-dashboard',
}: ScreenHeaderProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onBack}
      style={({ pressed }) => [styles.returnHeader, pressed && styles.pressed]}
      testID={testID}
    >
      <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
      <Text style={styles.returnHeaderText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  returnHeader: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
    minHeight: 40,
    paddingRight: spacing.md,
  },
  returnHeaderText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
