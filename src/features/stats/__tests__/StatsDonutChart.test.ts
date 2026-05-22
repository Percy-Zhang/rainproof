import { getDonutSliceIdAtPoint, getDonutSlices } from '../StatsDonutChart';
import type { StatsReportRollup } from '../../../domain/statsReports';

function rollup(id: string, amountMinor: number): StatsReportRollup {
  return {
    id,
    reportKind: 'expense',
    kind: 'category',
    categoryId: id,
    label: id,
    icon: 'ellipse-outline',
    color: '#1876A8',
    grossAmountMinor: amountMinor,
    netAmountMinor: amountMinor,
    lineCount: 1,
    percentage: 0,
    lineIds: [id],
  };
}

describe('StatsDonutChart geometry', () => {
  it('builds donut slices in rollup order', () => {
    const slices = getDonutSlices([rollup('food', 7000), rollup('housing', 3000)]);

    expect(slices.map((slice) => slice.rollup.id)).toEqual(['food', 'housing']);
    expect(slices[0].startAngle).toBeCloseTo(-Math.PI / 2);
    expect(slices[1].endAngle).toBeCloseTo((Math.PI * 3) / 2);
  });

  it('maps chart press locations to the matching slice', () => {
    const rollups = [rollup('food', 7000), rollup('housing', 3000)];

    expect(getDonutSliceIdAtPoint({ rollups, x: 110, y: 10 })).toBe('food');
    expect(getDonutSliceIdAtPoint({ rollups, x: 10, y: 110 })).toBe('housing');
  });

  it('ignores center and outside-chart presses', () => {
    const rollups = [rollup('food', 7000), rollup('housing', 3000)];

    expect(getDonutSliceIdAtPoint({ rollups, x: 110, y: 110 })).toBeUndefined();
    expect(getDonutSliceIdAtPoint({ rollups, x: 220, y: 220 })).toBeUndefined();
  });
});
