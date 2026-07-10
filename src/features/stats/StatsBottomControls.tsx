import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Pressable, Text, View } from 'react-native';

import { BottomSelectorPanel } from '../../components/BottomSelectorPanel';
import { FloatingDateTimePicker } from '../../components/FloatingDateTimePicker';
import {
  PeriodCarousel,
  type PeriodCarouselOption,
} from '../transactions/PeriodCarousel';
import { statsStyles as styles } from './StatsScreenStyles';
import type { StatsDatePickerTarget, StatsRangeMode } from './useStatsViewModel';

export function StatsBottomControls({
  customEndDate,
  customStartDate,
  datePickerTarget,
  onCloseDatePicker,
  onDatePickerChange,
  onOpenDatePicker,
  onSelectPeriodOption,
  rangeMode,
  selectedPeriodOption,
}: {
  customEndDate: string;
  customStartDate: string;
  datePickerTarget: StatsDatePickerTarget | null;
  onCloseDatePicker: () => void;
  onDatePickerChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  onOpenDatePicker: (target: StatsDatePickerTarget) => void;
  onSelectPeriodOption: (option: PeriodCarouselOption) => void;
  rangeMode: StatsRangeMode;
  selectedPeriodOption: PeriodCarouselOption;
}) {
  return (
    <BottomSelectorPanel testID="stats-bottom-controls">
      {rangeMode === 'custom' ? (
        <View style={styles.customRangeRow}>
          <DateSelector label="From" value={customStartDate} onPress={() => onOpenDatePicker('start')} />
          <DateSelector label="To" value={customEndDate} onPress={() => onOpenDatePicker('end')} />
          <FloatingDateTimePicker
            mode={datePickerTarget ? 'date' : null}
            value={new Date(`${datePickerTarget === 'start' ? customStartDate : customEndDate}T12:00:00`)}
            onChange={onDatePickerChange}
            onClose={onCloseDatePicker}
          />
        </View>
      ) : null}

      <PeriodCarousel
        selectedOption={selectedPeriodOption}
        onSelectOption={onSelectPeriodOption}
        testID="stats-period-carousel"
      />
    </BottomSelectorPanel>
  );
}

function DateSelector({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.dateSelector, pressed && styles.pressed]}
    >
      <Text style={styles.dateSelectorLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.dateSelectorValue}>{value}</Text>
    </Pressable>
  );
}
