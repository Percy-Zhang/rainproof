import { getAddTransactionBackAction } from '../addTransactionFlow';

describe('add transaction flow', () => {
  it('prioritizes dismissing native picker before backing out of pages', () => {
    expect(
      getAddTransactionBackAction({
        nativePickerOpen: true,
        page: 'details',
        pickerOpen: true,
      }),
    ).toBe('dismiss_native_picker');
  });

  it('steps back from picker to details to composer close', () => {
    expect(
      getAddTransactionBackAction({
        nativePickerOpen: false,
        page: 'details',
        pickerOpen: true,
      }),
    ).toBe('close_picker');
    expect(
      getAddTransactionBackAction({
        nativePickerOpen: false,
        page: 'details',
        pickerOpen: false,
      }),
    ).toBe('show_amount');
    expect(
      getAddTransactionBackAction({
        nativePickerOpen: false,
        page: 'split',
        pickerOpen: false,
      }),
    ).toBe('show_amount');
    expect(
      getAddTransactionBackAction({
        nativePickerOpen: false,
        page: 'amount',
        pickerOpen: false,
      }),
    ).toBe('close_composer');
  });
});
