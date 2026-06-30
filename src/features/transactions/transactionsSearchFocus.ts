export function shouldKeepTransactionsSearchVisible({
  keyboardVisible,
  searchQuery,
  searchFocused,
}: {
  keyboardVisible: boolean;
  searchQuery: string;
  searchFocused: boolean;
}): boolean {
  return searchFocused || keyboardVisible || searchQuery.trim().length > 0;
}
