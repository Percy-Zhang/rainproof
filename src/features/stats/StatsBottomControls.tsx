import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text, View } from 'react-native';

import { AccountFilterCarousel } from '../../components/AccountFilterCarousel';
import { BottomSelectorPanel } from '../../components/BottomSelectorPanel';
import { Chip } from '../../components/ui';
import type { Account } from '../../domain/types';
import {
  PeriodCarousel,
  type PeriodCarouselOption,
} from '../transactions/PeriodCarousel';
import { statsStyles as styles } from './StatsScreenStyles';
import { accountLabel } from './StatsScreenUtils';
import type { StatsDatePickerTarget, StatsRangeMode } from './useStatsViewModel';

export function StatsBottomControls({
  accountsForCurrency,
  currencies,
  currencyCode,
  customEndDate,
  customStartDate,
  datePickerTarget,
  effectiveAccountId,
  onChangeCurrency,
  onCloseDatePicker,
  onDatePickerChange,
  onOpenDatePicker,
  onSelectAccount,
  onSelectPeriodOption,
  rangeMode,
  selectedPeriodOption,
  showCurrencyCodes,
}: {
  accountsForCurrency: Account[];
  currencies: string[];
  currencyCode: string;
  customEndDate: string;
  customStartDate: string;
  datePickerTarget: StatsDatePickerTarget | null;
  effectiveAccountId: string;
  onChangeCurrency: (currencyCode: string) => void;
  onCloseDatePicker: () => void;
  onDatePickerChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  onOpenDatePicker: (target: StatsDatePickerTarget) => void;
  onSelectAccount: (accountId: string) => void;
  onSelectPeriodOption: (option: PeriodCarouselOption) => void;
  rangeMode: StatsRangeMode;
  selectedPeriodOption: PeriodCarouselOption;
  showCurrencyCodes: boolean;
}) {
  return (
    <BottomSelectorPanel testID="stats-bottom-controls">
      {showCurrencyCodes ? (
        <View style={styles.controlBlock}>
          <Text style={styles.label}>Currency</Text>
          <View style={styles.wrap}>
            {currencies.map((currency) => (
              <Chip key={currency} selected={currencyCode === currency} onPress={() => onChangeCurrency(currency)}>
                {currency}
              </Chip>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.controlBlock}>
        <Text style={styles.label}>Accounts</Text>
        <AccountFilterCarousel
          accounts={accountsForCurrency}
          allSelected={effectiveAccountId === 'all'}
          selectedAccountIds={effectiveAccountId === 'all' ? [] : [effectiveAccountId]}
          showCurrencyCodes={showCurrencyCodes}
          getAccountLabel={accountLabel}
          onPressAccount={onSelectAccount}
          onPressAll={() => onSelectAccount('all')}
        />
      </View>

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
