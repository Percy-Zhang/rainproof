import {
  getResponsiveAccountColumns,
  getResponsiveAccountColumnsForItemCount,
  getResponsiveAccountTileBasis,
  getResponsiveAccountTileBasisForColumns,
  getResponsiveWidthBucket,
} from '../responsiveLayout';

describe('responsive layout helpers', () => {
  it('classifies width buckets at conservative tablet breakpoints', () => {
    expect(getResponsiveWidthBucket(375)).toBe('narrow');
    expect(getResponsiveWidthBucket(599)).toBe('narrow');
    expect(getResponsiveWidthBucket(600)).toBe('medium');
    expect(getResponsiveWidthBucket(899)).toBe('medium');
    expect(getResponsiveWidthBucket(900)).toBe('wide');
  });

  it('returns account selector columns for narrow, medium, and wide widths', () => {
    expect(getResponsiveAccountColumns(390)).toBe(2);
    expect(getResponsiveAccountColumns(768)).toBe(3);
    expect(getResponsiveAccountColumns(1024)).toBe(4);
  });

  it('caps account selector columns by item count without shrinking one or two accounts', () => {
    expect(getResponsiveAccountColumnsForItemCount(1024, 1)).toBe(2);
    expect(getResponsiveAccountColumnsForItemCount(1024, 2)).toBe(2);
    expect(getResponsiveAccountColumnsForItemCount(1024, 3)).toBe(3);
    expect(getResponsiveAccountColumnsForItemCount(1024, 8)).toBe(4);
  });

  it('returns tile width percentages for account selector columns', () => {
    expect(getResponsiveAccountTileBasisForColumns(2)).toBe('48%');
    expect(getResponsiveAccountTileBasisForColumns(3)).toBe('31%');
    expect(getResponsiveAccountTileBasisForColumns(4)).toBe('23.5%');
    expect(getResponsiveAccountTileBasis(768)).toBe('31%');
  });
});
