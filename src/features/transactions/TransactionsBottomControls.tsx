import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text, View } from 'react-native';

import { BottomSelectorPanel } from '../../components/BottomSelectorPanel';
import { PeriodCarousel, type PeriodCarouselOption } from './PeriodCarousel';
import {
  transactionsScreenStyles as styles,
} from './TransactionsScreenStyles';
import type { TransactionDatePickerTarget, TransactionPeriodState } from './useTransactionsViewModel';

export function TransactionsBottomControls({
  datePickerTarget,
  onCloseDatePicker,
  onDatePickerChange,
  onOpenDatePicker,
  onSelectPeriodOption,
  periodState,
  selectedPeriodOption,
}: {
  datePickerTarget: TransactionDatePickerTarget | null;
  onCloseDatePicker: () => void;
  onDatePickerChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  onOpenDatePicker: (target: TransactionDatePickerTarget) => void;
  onSelectPeriodOption: (option: PeriodCarouselOption) => void;
  periodState: TransactionPeriodState;
  selectedPeriodOption: PeriodCarouselOption;
}) {
  const { customEndDate, customStartDate, rangeMode } = periodState;

  return (
    <BottomSelectorPanel testID="transactions-bottom-controls">
      {rangeMode === 'custom' ? (
        <View style={styles.customRangeRow}>
          <DateSelector label="From" value={customStartDate} onPress={() => onOpenDatePicker('start')} />
          <DateSelector label="To" value={customEndDate} onPress={() => onOpenDatePicker('end')} />
          {datePickerTarget ? (
            Platform.OS === 'android' ? (
              <DateTimePicker
                value={new Date(`${datePickerTarget === 'start' ? customStartDate : customEndDate}T12:00:00`)}
                mode="date"
                display="calendar"
                onChange={onDatePickerChange}
              />
            ) : (
              <View style={styles.datePickerPanel}>
                <DateTimePicker
                  value={new Date(`${datePickerTarget === 'start' ? customStartDate : customEndDate}T12:00:00`)}
                  mode="date"
                  display="compact"
                  onChange={onDatePickerChange}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={onCloseDatePicker}
                  style={({ pressed }) => [styles.datePickerDone, pressed && styles.pressed]}
                >
                  <Text style={styles.datePickerDoneText}>Done</Text>
                </Pressable>
              </View>
            )
          ) : null}
        </View>
      ) : null}

      <PeriodCarousel selectedOption={selectedPeriodOption} onSelectOption={onSelectPeriodOption} />
    </BottomSelectorPanel>
  );
}

function DateSelector({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dateSelector, pressed && styles.pressed]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.dateSelectorValue}>{value}</Text>
    </Pressable>
  );
}
