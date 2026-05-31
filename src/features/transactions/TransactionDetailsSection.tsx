import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import {
  AutocompleteField,
  DateTimePickerFields,
  InlineField,
  type NativePickerMode,
} from './TransactionFormComponents';
import { TransactionDateTimePicker } from './TransactionDateTimePicker';

type TransactionDetailsSectionProps = {
  dateLabel: string;
  group: string;
  groupSuggestions: string[];
  item: string;
  itemSuggestions: string[];
  labelSuggestions: string[];
  labels: string;
  nativePickerMode: NativePickerMode | null;
  nativePickerValue: Date;
  notes: string;
  onChangeGroup: (value: string) => void;
  onChangeItem: (value: string) => void;
  onChangeLabels: (value: string) => void;
  onChangeNotes: (value: string) => void;
  onCloseNativePicker: () => void;
  onNativePickerChange: (event: DateTimePickerEvent, selectedDate?: Date) => void;
  onPressDate: () => void;
  onPressTime: () => void;
  onSelectLabelSuggestion: (suggestion: string) => void;
  time: string;
};

type TransactionMetadataFieldsProps = Omit<TransactionDetailsSectionProps, 'item' | 'itemSuggestions' | 'onChangeItem'>;

export function TransactionMetadataFields({
  dateLabel,
  group,
  groupSuggestions,
  labelSuggestions,
  labels,
  nativePickerMode,
  nativePickerValue,
  notes,
  onChangeGroup,
  onChangeLabels,
  onChangeNotes,
  onCloseNativePicker,
  onNativePickerChange,
  onPressDate,
  onPressTime,
  onSelectLabelSuggestion,
  time,
}: TransactionMetadataFieldsProps) {
  return (
    <>
      <DateTimePickerFields
        dateValue={dateLabel}
        timeValue={time}
        onPressDate={onPressDate}
        onPressTime={onPressTime}
      />
      <TransactionDateTimePicker
        mode={nativePickerMode}
        value={nativePickerValue}
        onChange={onNativePickerChange}
        onClose={onCloseNativePicker}
      />

      <InlineField
        label="Notes"
        value={notes}
        onChange={onChangeNotes}
        placeholder="Optional"
      />
      <AutocompleteField
        label="Group"
        value={group}
        onChange={onChangeGroup}
        placeholder="Trip, project, shared"
        suggestions={groupSuggestions}
      />
      <AutocompleteField
        label="Labels"
        value={labels}
        onChange={onChangeLabels}
        onSelectSuggestion={onSelectLabelSuggestion}
        placeholder="holiday, shared, tax"
        suggestions={labelSuggestions}
      />
    </>
  );
}

export function TransactionDetailsSection({
  dateLabel,
  group,
  groupSuggestions,
  item,
  itemSuggestions,
  labelSuggestions,
  labels,
  nativePickerMode,
  nativePickerValue,
  notes,
  onChangeGroup,
  onChangeItem,
  onChangeLabels,
  onChangeNotes,
  onCloseNativePicker,
  onNativePickerChange,
  onPressDate,
  onPressTime,
  onSelectLabelSuggestion,
  time,
}: TransactionDetailsSectionProps) {
  return (
    <>
      <AutocompleteField
        label="Item"
        value={item}
        onChange={onChangeItem}
        placeholder="Groceries, Salary, Transfer"
        suggestions={itemSuggestions}
      />

      <TransactionMetadataFields
        dateLabel={dateLabel}
        group={group}
        groupSuggestions={groupSuggestions}
        labels={labels}
        labelSuggestions={labelSuggestions}
        nativePickerMode={nativePickerMode}
        nativePickerValue={nativePickerValue}
        notes={notes}
        time={time}
        onChangeGroup={onChangeGroup}
        onChangeLabels={onChangeLabels}
        onChangeNotes={onChangeNotes}
        onCloseNativePicker={onCloseNativePicker}
        onNativePickerChange={onNativePickerChange}
        onPressDate={onPressDate}
        onPressTime={onPressTime}
        onSelectLabelSuggestion={onSelectLabelSuggestion}
      />
    </>
  );
}
