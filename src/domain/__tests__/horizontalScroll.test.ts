import { getHorizontalScrollEdges, getNextHorizontalOffset } from '../horizontalScroll';

describe('horizontal scroll helpers', () => {
  it('reports visible scroll edges from offset and width', () => {
    expect(getHorizontalScrollEdges({ contentWidth: 500, layoutWidth: 200, offsetX: 0 })).toEqual({
      canScrollLeft: false,
      canScrollRight: true,
      maxOffset: 300,
    });

    expect(getHorizontalScrollEdges({ contentWidth: 500, layoutWidth: 200, offsetX: 300 })).toEqual({
      canScrollLeft: true,
      canScrollRight: false,
      maxOffset: 300,
    });
  });

  it('clamps step scrolling within the scrollable range', () => {
    const metrics = { contentWidth: 500, layoutWidth: 200, offsetX: 250 };

    expect(getNextHorizontalOffset(metrics, 1, 100)).toBe(300);
    expect(getNextHorizontalOffset(metrics, -1, 300)).toBe(0);
  });

  it('keeps edge arrows hidden within the edge threshold', () => {
    expect(getHorizontalScrollEdges({ contentWidth: 500, layoutWidth: 200, offsetX: 1 })).toMatchObject({
      canScrollLeft: false,
      canScrollRight: true,
    });

    expect(getHorizontalScrollEdges({ contentWidth: 500, layoutWidth: 200, offsetX: 299 })).toMatchObject({
      canScrollLeft: true,
      canScrollRight: false,
    });
  });

  it('keeps step scrolling stable when content is not scrollable', () => {
    const metrics = { contentWidth: 180, layoutWidth: 200, offsetX: 40 };

    expect(getNextHorizontalOffset(metrics, 1, 100)).toBe(0);
    expect(getNextHorizontalOffset(metrics, -1, 100)).toBe(0);
  });

  it('does not show arrows when content fits', () => {
    expect(getHorizontalScrollEdges({ contentWidth: 180, layoutWidth: 200, offsetX: 0 })).toEqual({
      canScrollLeft: false,
      canScrollRight: false,
      maxOffset: 0,
    });
  });
});
