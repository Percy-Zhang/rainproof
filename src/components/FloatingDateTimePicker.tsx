import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';

export type FloatingDateTimePickerMode = 'date' | 'time';

type FloatingDateTimePickerProps = {
  mode: FloatingDateTimePickerMode | null;
  onChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  onClose: () => void;
  value: Date;
};

export function FloatingDateTimePicker({
  mode,
  onChange,
  onClose,
  value,
}: FloatingDateTimePickerProps) {
  if (!mode) {
    return null;
  }

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display={getFloatingDateTimePickerDisplay(mode)}
        is24Hour
        onChange={onChange}
      />
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View accessibilityViewIsModal style={styles.overlay}>
        <Pressable
          accessibilityLabel="Dismiss date and time picker"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View style={[
          styles.floatingPickerCard,
          mode === 'date' ? styles.floatingDatePickerCard : styles.floatingTimePickerCard,
        ]}>
          <DateTimePicker
            value={value}
            mode={mode}
            display={getFloatingDateTimePickerDisplay(mode)}
            themeVariant="light"
            textColor={colors.ink}
            accentColor={mode === 'date' ? colors.primaryDark : undefined}
            is24Hour
            onChange={onChange}
            style={[
              styles.iosPicker,
              mode === 'date' ? styles.iosDatePicker : styles.iosTimePicker,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function getFloatingDateTimePickerDisplay(
  mode: FloatingDateTimePickerMode,
): 'calendar' | 'clock' | 'inline' | 'spinner' {
  if (Platform.OS === 'ios') {
    return mode === 'date' ? 'inline' : 'spinner';
  }

  return mode === 'date' ? 'calendar' : 'clock';
}

const styles = StyleSheet.create({
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  floatingPickerCard: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 8,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    width: '100%',
  },
  floatingDatePickerCard: {
    maxWidth: 360,
  },
  floatingTimePickerCard: {
    maxWidth: 340,
    paddingHorizontal: 0,
  },
  iosDatePicker: {
    width: '100%',
  },
  iosPicker: {
    backgroundColor: colors.surface,
  },
  iosTimePicker: {
    alignSelf: 'stretch',
    width: '100%',
  },
  doneButton: {
    alignItems: 'center',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  doneButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.78,
  },
});
