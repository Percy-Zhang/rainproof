export type HorizontalScrollMetrics = {
  contentWidth: number;
  layoutWidth: number;
  offsetX: number;
};

export type HorizontalScrollEdges = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  maxOffset: number;
};

const edgeThreshold = 1;

export function getHorizontalScrollEdges(metrics: HorizontalScrollMetrics): HorizontalScrollEdges {
  const maxOffset = Math.max(0, metrics.contentWidth - metrics.layoutWidth);
  const offsetX = clamp(metrics.offsetX, 0, maxOffset);

  return {
    canScrollLeft: offsetX > edgeThreshold,
    canScrollRight: offsetX < maxOffset - edgeThreshold,
    maxOffset,
  };
}

export function getNextHorizontalOffset(
  metrics: HorizontalScrollMetrics,
  direction: -1 | 1,
  step: number,
): number {
  const maxOffset = Math.max(0, metrics.contentWidth - metrics.layoutWidth);
  return clamp(metrics.offsetX + direction * step, 0, maxOffset);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
