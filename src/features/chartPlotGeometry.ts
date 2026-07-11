export type HorizontalPlotGeometry = {
  left: number;
  right: number;
  width: number;
};

export function getHorizontalPlotGeometry(
  containerWidth: number,
  leftInset = 0,
  rightInset = 0,
): HorizontalPlotGeometry {
  const safeContainerWidth = Math.max(1, containerWidth);
  const left = Math.max(0, Math.min(safeContainerWidth - 1, leftInset));
  const right = Math.max(
    left + 1,
    Math.min(safeContainerWidth, safeContainerWidth - Math.max(0, rightInset)),
  );

  return {
    left,
    right,
    width: right - left,
  };
}

export function getHorizontalPlotX(
  index: number,
  pointCount: number,
  geometry: HorizontalPlotGeometry,
): number {
  if (pointCount <= 1) {
    return geometry.left + geometry.width / 2;
  }

  const clampedIndex = Math.max(0, Math.min(pointCount - 1, index));
  return geometry.left + (clampedIndex / (pointCount - 1)) * geometry.width;
}

export function getNearestHorizontalPlotPointIndex({
  geometry,
  pointCount,
  x,
}: {
  geometry: HorizontalPlotGeometry;
  pointCount: number;
  x: number;
}): number {
  if (pointCount <= 1) {
    return 0;
  }

  const clampedX = Math.max(geometry.left, Math.min(geometry.right, x));
  const ratio = (clampedX - geometry.left) / geometry.width;
  return Math.max(0, Math.min(pointCount - 1, Math.round(ratio * (pointCount - 1))));
}
