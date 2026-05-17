export type AddTransactionPage = 'amount' | 'details';

export type AddTransactionBackState = {
  nativePickerOpen: boolean;
  page: AddTransactionPage;
  pickerOpen: boolean;
};

export type AddTransactionBackAction =
  | 'dismiss_native_picker'
  | 'close_picker'
  | 'show_amount'
  | 'close_composer';

export function getAddTransactionBackAction(state: AddTransactionBackState): AddTransactionBackAction {
  if (state.nativePickerOpen) {
    return 'dismiss_native_picker';
  }

  if (state.pickerOpen) {
    return 'close_picker';
  }

  if (state.page === 'details') {
    return 'show_amount';
  }

  return 'close_composer';
}
