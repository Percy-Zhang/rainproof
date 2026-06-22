import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { FloatingDateTimePicker } from '../../components/FloatingDateTimePicker';
import type { NativePickerMode } from './TransactionFormComponents';

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
  return (
    <FloatingDateTimePicker
      mode={mode}
      value={value}
      onChange={onChange}
      onClose={onClose}
    />
  );
}
