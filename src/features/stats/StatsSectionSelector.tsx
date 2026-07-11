import { useCallback, useEffect, useRef } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, spacing, typography } from '../../theme/tokens';

export type StatsSection = 'breakdown' | 'balance' | 'changes' | 'cashFlow' | 'amounts';

const STATS_SECTION_INDICATOR_DURATION_MS = 150;
const STATS_SELECTOR_EDGE_PADDING = spacing.sm;

const STATS_SECTIONS: readonly { id: StatsSection; label: string }[] = [
  { id: 'breakdown', label: 'Breakdown' },
  { id: 'balance', label: 'Balance' },
  { id: 'changes', label: 'Changes' },
  { id: 'cashFlow', label: 'Cash Flow' },
  { id: 'amounts', label: 'Amounts' },
];

export function StatsSectionSelector({
  onSelectSection,
  selectedSection,
}: {
  onSelectSection: (section: StatsSection) => void;
  selectedSection: StatsSection;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const optionLayoutsRef = useRef(new Map<StatsSection, { width: number; x: number }>());
  const viewportWidthRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const isDraggingRef = useRef(false);
  const pendingSelectionRef = useRef<StatsSection | null>(null);
  const indicatorReadyRef = useRef(false);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);

  const keepSectionVisible = useCallback((section: StatsSection) => {
    if (isDraggingRef.current) {
      pendingSelectionRef.current = section;
      return;
    }

    const layout = optionLayoutsRef.current.get(section);
    if (!layout || viewportWidthRef.current <= 0) {
      pendingSelectionRef.current = section;
      return;
    }

    const targetOffset = getStatsSelectorScrollTarget({
      itemWidth: layout.width,
      itemX: layout.x,
      scrollX: scrollOffsetRef.current,
      viewportWidth: viewportWidthRef.current,
    });
    pendingSelectionRef.current = null;

    if (targetOffset !== null) {
      scrollRef.current?.scrollTo({ animated: true, x: targetOffset });
    }
  }, []);

  const moveIndicator = useCallback((section: StatsSection, animated: boolean) => {
    const layout = optionLayoutsRef.current.get(section);
    if (!layout) {
      return;
    }

    cancelAnimation(indicatorX);
    cancelAnimation(indicatorWidth);
    cancelAnimation(indicatorOpacity);

    if (!indicatorReadyRef.current || !animated) {
      indicatorX.value = layout.x;
      indicatorWidth.value = layout.width;
      indicatorOpacity.value = 1;
      indicatorReadyRef.current = true;
      return;
    }

    const timing = {
      duration: STATS_SECTION_INDICATOR_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    };
    indicatorX.value = withTiming(layout.x, timing);
    indicatorWidth.value = withTiming(layout.width, timing);
    indicatorOpacity.value = withTiming(1, timing);
  }, [indicatorOpacity, indicatorWidth, indicatorX]);

  const handleOptionLayout = useCallback((
    section: StatsSection,
    event: LayoutChangeEvent,
  ) => {
    const { width, x } = event.nativeEvent.layout;
    optionLayoutsRef.current.set(section, { width, x });

    if (section === selectedSection) {
      moveIndicator(section, indicatorReadyRef.current);
      keepSectionVisible(section);
    }
  }, [keepSectionVisible, moveIndicator, selectedSection]);

  const handleSelectSection = useCallback((section: StatsSection) => {
    pendingSelectionRef.current = section;
    moveIndicator(section, true);
    keepSectionVisible(section);
    onSelectSection(section);
  }, [keepSectionVisible, moveIndicator, onSelectSection]);

  const finishManualScroll = useCallback(() => {
    isDraggingRef.current = false;
    if (pendingSelectionRef.current) {
      keepSectionVisible(pendingSelectionRef.current);
    }
  }, [keepSectionVisible]);

  useEffect(() => {
    moveIndicator(selectedSection, true);
    keepSectionVisible(selectedSection);
  }, [keepSectionVisible, moveIndicator, selectedSection]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      horizontal
      onLayout={(event) => {
        viewportWidthRef.current = event.nativeEvent.layout.width;
        keepSectionVisible(selectedSection);
      }}
      onMomentumScrollBegin={() => {
        isDraggingRef.current = true;
      }}
      onMomentumScrollEnd={finishManualScroll}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollOffsetRef.current = event.nativeEvent.contentOffset.x;
      }}
      onScrollBeginDrag={() => {
        isDraggingRef.current = true;
      }}
      onScrollEndDrag={finishManualScroll}
      ref={scrollRef}
      scrollEventThrottle={16}
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      testID="stats-section-selector"
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, indicatorStyle]}
        testID="stats-section-indicator"
      />
      {STATS_SECTIONS.map((section) => {
        const selected = section.id === selectedSection;

        return (
          <Pressable
            key={section.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onLayout={(event) => handleOptionLayout(section.id, event)}
            onPress={() => handleSelectSection(section.id)}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionSelected,
              pressed && styles.pressed,
            ]}
            testID={`stats-section-${section.id}`}
          >
            <Text
              numberOfLines={1}
              style={[styles.optionText, selected && styles.optionTextSelected]}
            >
              {section.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  content: {
    gap: spacing.sm,
    paddingBottom: 4,
    paddingRight: spacing.sm,
    position: 'relative',
  },
  indicator: {
    backgroundColor: colors.ink,
    borderRadius: 2,
    bottom: 0,
    height: 3,
    left: 0,
    position: 'absolute',
  },
  option: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  optionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  optionTextSelected: {
    color: colors.surface,
  },
  pressed: {
    opacity: 0.78,
  },
});

export function getStatsSelectorScrollTarget({
  itemWidth,
  itemX,
  scrollX,
  viewportWidth,
}: {
  itemWidth: number;
  itemX: number;
  scrollX: number;
  viewportWidth: number;
}): number | null {
  const visibleLeft = scrollX + STATS_SELECTOR_EDGE_PADDING;
  const visibleRight = scrollX + viewportWidth - STATS_SELECTOR_EDGE_PADDING;
  const itemRight = itemX + itemWidth;

  if (itemX < visibleLeft) {
    return Math.max(0, itemX - STATS_SELECTOR_EDGE_PADDING);
  }

  if (itemRight > visibleRight) {
    return Math.max(0, itemRight - viewportWidth + STATS_SELECTOR_EDGE_PADDING);
  }

  return null;
}
