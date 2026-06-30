import {
  getReorderRowMetrics,
  getUniqueOrderedIds,
  haveIdsInSameOrder,
  mergeIdsByPreferredOrder,
  mergeVisibleReorderIds,
  orderItemsById,
  orderItemsByIdOrFallback,
} from '../reorder';

describe('reorder helpers', () => {
  it('compares stable ids by order', () => {
    expect(haveIdsInSameOrder(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(haveIdsInSameOrder(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(haveIdsInSameOrder(['a', 'b'], ['a'])).toBe(false);
  });

  it('normalizes duplicate and blank ids without changing first-seen order', () => {
    expect(getUniqueOrderedIds([' a ', '', 'b', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('merges a preferred reorder with available ids and appends missing items', () => {
    expect(mergeIdsByPreferredOrder(['a', 'b', 'c', 'd'], ['c', 'a'])).toEqual(['c', 'a', 'b', 'd']);
  });

  it('builds reorder row offsets from measured and fallback heights', () => {
    expect(getReorderRowMetrics(['a', 'b', 'c'], { a: 20, c: 30 }, 50)).toEqual({
      offsets: {
        a: 0,
        b: 20,
        c: 70,
      },
      totalHeight: 100,
    });
  });

  it('merges visible reorder ids and preserves missing current rows', () => {
    expect(mergeVisibleReorderIds(['a', 'b', 'c', 'd'], ['c', 'unknown', 'a'])).toEqual(['c', 'a', 'b', 'd']);
  });

  it('orders items by id while preserving missing items', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    expect(orderItemsById(items, ['c', 'a'])).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
    expect(orderItemsById(items, ['a', 'b', 'c'])).toBe(items);
  });

  it('orders items by id while preserving existing object identity', () => {
    const itemA = { id: 'a' };
    const itemB = { id: 'b' };
    const itemC = { id: 'c' };
    const reordered = orderItemsByIdOrFallback([itemA, itemB, itemC], ['c', 'a', 'b'], []);

    expect(reordered).toEqual([itemC, itemA, itemB]);
    expect(reordered[0]).toBe(itemC);
    expect(reordered[1]).toBe(itemA);
    expect(reordered[2]).toBe(itemB);
  });

  it('falls back when preferred ids cannot represent the current items exactly', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    const fallback = [{ id: 'b' }, { id: 'missing' }];

    expect(orderItemsByIdOrFallback(items, ['b', 'missing'], fallback)).toBe(fallback);
    expect(orderItemsByIdOrFallback(items, ['b'], fallback)).toBe(fallback);
  });
});
