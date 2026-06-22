export const RESPONSIVE_BREAKPOINTS = {
  medium: 600,
  wide: 900,
} as const;

export const RESPONSIVE_ACCOUNT_TILE_MIN_WIDTH = 130;

export type ResponsiveWidthBucket = 'narrow' | 'medium' | 'wide';
export type ResponsiveAccountColumns = 2 | 3 | 4;

export function getResponsiveWidthBucket(width: number): ResponsiveWidthBucket {
  if (width >= RESPONSIVE_BREAKPOINTS.wide) {
    return 'wide';
  }

  if (width >= RESPONSIVE_BREAKPOINTS.medium) {
    return 'medium';
  }

  return 'narrow';
}

export function getResponsiveAccountColumns(width: number): ResponsiveAccountColumns {
  switch (getResponsiveWidthBucket(width)) {
    case 'wide':
      return 4;
    case 'medium':
      return 3;
    case 'narrow':
      return 2;
  }
}

export function getResponsiveAccountColumnsForItemCount(
  width: number,
  itemCount: number,
): ResponsiveAccountColumns {
  return Math.min(getResponsiveAccountColumns(width), Math.max(itemCount, 2)) as ResponsiveAccountColumns;
}

export function getResponsiveAccountTileBasisForColumns(
  columns: ResponsiveAccountColumns,
): '48%' | '31%' | '23.5%' {
  switch (columns) {
    case 4:
      return '23.5%';
    case 3:
      return '31%';
    case 2:
      return '48%';
  }
}

export function getResponsiveAccountTileBasis(width: number): '48%' | '31%' | '23.5%' {
  return getResponsiveAccountTileBasisForColumns(getResponsiveAccountColumns(width));
}
