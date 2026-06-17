import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { toDateInputValue, toTimeInputValue } from '../../domain/dates';
import type { NativePickerMode } from './TransactionFormComponents';

type UseTransactionDateTimePickerOptions = {
  canChange?: boolean;
  onChangeDate: (date: string) => void;
  onChangeTime: (time: string) => void;
};

export function useTransactionDateTimePicker({
  canChange = true,
  onChangeDate,
  onChangeTime,
}: UseTransactionDateTimePickerOptions) {
  const [nativePickerMode, setNativePickerMode] = useState<NativePickerMode | null>(null);

  const closeNativePicker = useCallback(() => {
    setNativePickerMode(null);
  }, []);

  const openDatePicker = useCallback(() => {
    setNativePickerMode('date');
  }, []);

  const openTimePicker = useCallback(() => {
    setNativePickerMode('time');
  }, []);

  const handleNativePickerChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      closeNativePicker();
      return;
    }

    if (!canChange || !selectedDate || !nativePickerMode) {
      return;
    }

    if (nativePickerMode === 'date') {
      onChangeDate(toDateInputValue(selectedDate));
    } else {
      onChangeTime(toTimeInputValue(selectedDate));
    }

    if (Platform.OS === 'android') {
      closeNativePicker();
    }
  }, [canChange, closeNativePicker, nativePickerMode, onChangeDate, onChangeTime]);

  return {
    closeNativePicker,
    handleNativePickerChange,
    nativePickerMode,
    openDatePicker,
    openTimePicker,
  };
}
