export function findRouteItemById<T extends { id: string }>(
  items: readonly T[] | undefined,
  id: string,
): T | undefined {
  return items?.find((item) => item.id === id);
}
