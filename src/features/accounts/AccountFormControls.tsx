import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { accountThemeColors, getTransparentColor } from '../../domain/accountThemes';
import { colors, spacing, typography } from '../../theme/tokens';

const placeholderColor = `${colors.muted}99`;

export function AccountField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'decimal-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
      />
    </View>
  );
}

export function IconToggle({
  accessibilityLabel,
  icon,
  selected,
  onPress,
}: {
  accessibilityLabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconToggle,
        selected && styles.iconToggleSelected,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={22}
        color={selected ? colors.primaryDark : colors.muted}
      />
    </Pressable>
  );
}

export function AccountColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <View style={styles.colorPicker}>
      <Text style={styles.label}>Account color</Text>
      <View style={styles.colorSwatches}>
        {accountThemeColors.map((color) => (
          <Pressable
            key={color}
            accessibilityRole="button"
            onPress={() => onChange(color)}
            style={({ pressed }) => [
              styles.colorSwatchButton,
              value === color && { borderColor: color, backgroundColor: getTransparentColor(color, '24') },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.colorSwatch, { backgroundColor: color }]} />
          </Pressable>
        ))}
      </View>
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
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multilineInput: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  iconToggle: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconToggleSelected: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.primary,
  },
  colorPicker: {
    gap: spacing.xs,
  },
  colorSwatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorSwatchButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  colorSwatch: {
    borderRadius: 999,
    height: 20,
    width: 20,
  },
  pressed: {
    opacity: 0.78,
  },
});
