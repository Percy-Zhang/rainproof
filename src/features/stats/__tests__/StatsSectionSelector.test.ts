import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import {
  StatsSectionSelector,
  getStatsSelectorScrollTarget,
  type StatsSection,
} from '../StatsSectionSelector';

describe('StatsSectionSelector', () => {
  it('keeps all sections accessible and updates selection immediately', () => {
    const screen = render(React.createElement(SelectorHarness));

    expect(screen.getByText('Breakdown')).toBeTruthy();
    expect(screen.getByText('Balance')).toBeTruthy();
    expect(screen.getByText('Changes')).toBeTruthy();
    expect(screen.getByText('Cash Flow')).toBeTruthy();
    expect(screen.getByText('Amounts')).toBeTruthy();
    expect(screen.getByTestId('stats-section-indicator')).toBeTruthy();

    fireEvent.press(screen.getByTestId('stats-section-balance'));

    expect(screen.getByTestId('stats-section-balance').props.accessibilityState).toEqual({ selected: true });
  });

  it('allows the latest tap to win while manual selector scrolling is active', () => {
    const screen = render(React.createElement(SelectorHarness));

    fireEvent(screen.getByTestId('stats-section-selector'), 'scrollBeginDrag');
    fireEvent.press(screen.getByTestId('stats-section-balance'));
    fireEvent.press(screen.getByTestId('stats-section-cashFlow'));
    fireEvent.press(screen.getByTestId('stats-section-amounts'));

    expect(screen.getByTestId('stats-section-amounts').props.accessibilityState).toEqual({ selected: true });
  });

  it('scrolls only when a selected item is outside the comfortable visible bounds', () => {
    expect(getStatsSelectorScrollTarget({
      itemWidth: 80,
      itemX: 120,
      scrollX: 100,
      viewportWidth: 240,
    })).toBeNull();
    expect(getStatsSelectorScrollTarget({
      itemWidth: 80,
      itemX: 80,
      scrollX: 100,
      viewportWidth: 240,
    })).toBe(72);
    expect(getStatsSelectorScrollTarget({
      itemWidth: 90,
      itemX: 300,
      scrollX: 100,
      viewportWidth: 240,
    })).toBe(158);
  });
});

function SelectorHarness() {
  const [selectedSection, setSelectedSection] = useState<StatsSection>('breakdown');

  return React.createElement(StatsSectionSelector, {
    onSelectSection: setSelectedSection,
    selectedSection,
  });
}
