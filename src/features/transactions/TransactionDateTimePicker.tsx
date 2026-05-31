import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../../theme/tokens';
import {
  getNativePickerDisplay,
  type NativePickerMode,
} from './TransactionFormComponents';

type TransactionDateTimePickerProps = {
  mode: NativePickerMode | null;
  onChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  onClose: () => void;
  value: Date;
};

export function TransactionDateTimePicker({
  mode,
  onChange,
  onClose,
  value,
}: TransactionDateTimePickerProps) {
  if (!mode) {
    return null;
  }

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display={getNativePickerDisplay(mode)}
        is24Hour
        onChange={onChange}
      />
    );
  }

  return (
    <View style={styles.nativePickerPanel}>
      <DateTimePicker
        value={value}
        mode={mode}
        display={getNativePickerDisplay(mode)}
        is24Hour
        onChange={onChange}
      />
      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={({ pressed }) => [styles.nativePickerDone, pressed && styles.pressed]}
      >
        <Text style={styles.nativePickerDoneText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  pressed: {
    opacity: 0.78,
  },
});
