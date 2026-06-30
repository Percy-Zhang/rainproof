export function getUniqueOrderedIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const orderedIds: string[] = [];

  for (const id of ids) {
    const normalizedId = id.trim();
    if (!normalizedId || seen.has(normalizedId)) {
      continue;
    }

    seen.add(normalizedId);
    orderedIds.push(normalizedId);
  }

  return orderedIds;
}

export function haveIdsInSameOrder(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((id, index) => id === right[index]);
}

export type ReorderRowMeasurementMap = Record<string, number>;
export type ReorderRowOffsetMap = Record<string, number>;

export function getReorderRowMetrics(
  rowIds: readonly string[],
  rowMeasurements: ReorderRowMeasurementMap,
  fallbackRowHeight: number,
): { offsets: ReorderRowOffsetMap; totalHeight: number } {
  const offsets: ReorderRowOffsetMap = {};
  let totalHeight = 0;

  for (const rowId of rowIds) {
    offsets[rowId] = totalHeight;
    totalHeight += rowMeasurements[rowId] ?? fallbackRowHeight;
  }

  return {
    offsets,
    totalHeight,
  };
}

export function mergeVisibleReorderIds<T extends string>(
  currentRowIds: readonly T[],
  nextOrderIds: readonly T[],
): T[] {
  const currentIdSet = new Set(currentRowIds);
  const nextIdSet = new Set(nextOrderIds);
  const orderedIds = nextOrderIds.filter((id) => currentIdSet.has(id));
  return [
    ...orderedIds,
    ...currentRowIds.filter((id) => !nextIdSet.has(id)),
  ];
}

export function mergeIdsByPreferredOrder(
  availableIds: readonly string[],
  preferredIds: readonly string[],
): string[] {
  const availableIdSet = new Set(availableIds);
  const mergedIds = getUniqueOrderedIds(preferredIds).filter((id) => availableIdSet.has(id));
  const preferredIdSet = new Set(mergedIds);

  return [
    ...mergedIds,
    ...availableIds.filter((id) => !preferredIdSet.has(id)),
  ];
}

export function orderItemsById<T extends { id: string }>(
  items: T[],
  preferredIds: readonly string[] | null | undefined,
): T[] {
  if (!preferredIds?.length) {
    return items;
  }

  const currentIds = items.map((item) => item.id);
  const orderedIds = mergeIdsByPreferredOrder(currentIds, preferredIds);
  if (haveIdsInSameOrder(currentIds, orderedIds)) {
    return items;
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  return orderedIds
    .map((id) => itemById.get(id))
    .filter((item): item is T => Boolean(item));
}

export function orderItemsByIdOrFallback<T extends { id: string }>(
  items: T[],
  preferredIds: readonly string[],
  fallbackItems: T[],
): T[] {
  if (!preferredIds.length || preferredIds.length !== items.length) {
    return fallbackItems;
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  const orderedItems: T[] = [];

  for (const id of preferredIds) {
    const item = itemById.get(id);
    if (!item) {
      return fallbackItems;
    }

    orderedItems.push(item);
  }

  return orderedItems;
}
