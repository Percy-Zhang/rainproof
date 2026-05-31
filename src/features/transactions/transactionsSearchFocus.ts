export function shouldCollapseTransactionsAccountSelector({
  keyboardVisible,
  searchFocused,
}: {
  keyboardVisible: boolean;
  searchFocused: boolean;
}): boolean {
  return searchFocused && keyboardVisible;
}
