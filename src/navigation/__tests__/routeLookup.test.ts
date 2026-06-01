import { findRouteItemById } from '../routeLookup';

describe('findRouteItemById', () => {
  it('returns the matching item by route id', () => {
    expect(findRouteItemById([{ id: 'daily' }, { id: 'savings' }], 'savings')).toEqual({ id: 'savings' });
  });

  it('returns undefined for missing collections or ids', () => {
    expect(findRouteItemById(undefined, 'missing')).toBeUndefined();
    expect(findRouteItemById([{ id: 'daily' }], 'missing')).toBeUndefined();
  });
});
