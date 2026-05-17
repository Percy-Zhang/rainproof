import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { DatePreset } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';

export type PeriodOption = Exclude<DatePreset, 'custom'>;
export type PeriodCarouselOption = PeriodOption | 'custom';

export const periodOptions: PeriodCarouselOption[] = [
  'last_week',
  'last_month',
  'last_quarter',
  'last_6_months',
  'last_year',
  'custom',
];

export const periodLabels: Record<PeriodCarouselOption, string> = {
  last_week: '7 days',
  last_month: '30 days',
  last_quarter: '3 months',
  last_6_months: '6 months',
  last_year: '1 year',
  custom: 'Specific dates',
};

type PeriodCarouselProps = {
  selectedOption: PeriodCarouselOption;
  onSelectOption: (option: PeriodCarouselOption) => void;
  testID?: string;
};

export function PeriodCarousel({ selectedOption, onSelectOption, testID }: PeriodCarouselProps) {
  const scrollRef = useRef<ScrollView>(null);
  const hasSyncedRef = useRef(false);
  const selectionSourceRef = useRef<'arrow' | 'swipe' | null>(null);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const selectedIndex = periodOptions.indexOf(selectedOption);
  const canScrollLeft = selectedIndex > 0;
  const canScrollRight = selectedIndex < periodOptions.length - 1;

  useEffect(() => {
    if (carouselWidth > 0) {
      scrollRef.current?.scrollTo({
        animated: hasSyncedRef.current && selectionSourceRef.current === 'arrow',
        x: selectedIndex * carouselWidth,
      });
      hasSyncedRef.current = true;
      selectionSourceRef.current = null;
    }
  }, [carouselWidth, selectedIndex]);

  function selectOption(option: PeriodCarouselOption) {
    onSelectOption(option);
  }

  function scrollBy(direction: -1 | 1) {
    const nextIndex = Math.min(periodOptions.length - 1, Math.max(0, selectedIndex + direction));

    if (nextIndex === selectedIndex) {
      return;
    }

    selectionSourceRef.current = 'arrow';
    selectOption(periodOptions[nextIndex]);
  }

  function handleLayout(event: LayoutChangeEvent) {
    setCarouselWidth(event.nativeEvent.layout.width);
  }

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!carouselWidth) {
      return;
    }

    const offsetX = event.nativeEvent.contentOffset.x;
    const nextIndex = Math.min(
      periodOptions.length - 1,
      Math.max(0, Math.round(offsetX / carouselWidth)),
    );
    selectionSourceRef.current = 'swipe';
    selectOption(periodOptions[nextIndex]);
  }

  return (
    <View style={styles.periodCarousel} onLayout={handleLayout} testID={testID}>
      {carouselWidth > 0 && canScrollLeft ? (
        <Pressable
          accessibilityLabel="Previous period"
          accessibilityRole="button"
          onPress={() => scrollBy(-1)}
          style={({ pressed }) => [styles.carouselHintLeft, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={16} color={colors.primaryDark} />
        </Pressable>
      ) : null}
      {carouselWidth > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          contentOffset={{ x: selectedIndex * carouselWidth, y: 0 }}
          disableIntervalMomentum
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          snapToInterval={carouselWidth}
          snapToAlignment="start"
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
        >
          {periodOptions.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => selectOption(option)}
              style={({ pressed }) => [
                styles.periodSlide,
                { width: carouselWidth },
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.periodSlideText}>{periodLabels[option]}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.periodSlide}>
          <Text style={styles.periodSlideText}>{periodLabels[selectedOption]}</Text>
        </View>
      )}
      {carouselWidth > 0 && canScrollRight ? (
        <Pressable
          accessibilityLabel="Next period"
          accessibilityRole="button"
          onPress={() => scrollBy(1)}
          style={({ pressed }) => [styles.carouselHintRight, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.primaryDark} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  periodCarousel: {
    borderColor: colors.primary,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  periodSlide: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  periodSlideText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  carouselHintLeft: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: 0,
    width: 28,
    zIndex: 2,
  },
  carouselHintRight: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
    width: 28,
    zIndex: 2,
  },
  pressed: {
    opacity: 0.78,
  },
});
