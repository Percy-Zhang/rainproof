import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';

import {
  getReorderRowMetrics,
  mergeVisibleReorderIds,
  type ReorderRowMeasurementMap,
  type ReorderRowOffsetMap,
} from '../../domain/reorder';
import type { DashboardCardId, DashboardCardSetting } from '../../domain/types';
import { useReorderAutoScroll } from '../useReorderAutoScroll';

const DASHBOARD_CARD_REORDER_ACTIVATION_MS = 150;
const DASHBOARD_CARD_REORDER_SETTLE_MS = 150;
const DASHBOARD_CARD_REORDER_FALLBACK_ROW_HEIGHT = 220;
const DASHBOARD_CARD_REORDER_SLOT_ANIMATION = {
  duration: DASHBOARD_CARD_REORDER_SETTLE_MS,
  easing: Easing.out(Easing.cubic),
};

type RowHeightMap = ReorderRowMeasurementMap;
type RowOffsetMap = ReorderRowOffsetMap;

type DashboardCardReorderRenderState = {
  dragging: boolean;
  reorderActive: boolean;
};

type DashboardCardReorderListProps = {
  contentContainerStyle?: StyleProp<ViewStyle>;
  headerComponent?: ReactNode;
  rows: DashboardCardSetting[];
  renderRow: (row: DashboardCardSetting, state: DashboardCardReorderRenderState) => ReactNode;
  onDragBegin?: (cardId: DashboardCardId) => void;
  onDragEnd: (cardIds: DashboardCardId[]) => void;
};

export function DashboardCardReorderList({
  contentContainerStyle,
  headerComponent,
  rows,
  renderRow,
  onDragBegin,
  onDragEnd,
}: DashboardCardReorderListProps) {
  const rowIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const [rowHeights, setRowHeights] = useState<RowHeightMap>({});
  const metrics = useMemo(
    () => getReorderRowMetrics(rowIds, rowHeights, DASHBOARD_CARD_REORDER_FALLBACK_ROW_HEIGHT),
    [rowHeights, rowIds],
  );
  const rowIdsRef = useRef(rowIds);
  const activeRowId = useSharedValue<DashboardCardId | null>(null);
  const dragTop = useSharedValue(0);
  const orderIds = useSharedValue<DashboardCardId[]>(rowIds);
  const rowOffsets = useSharedValue<RowOffsetMap>(metrics.offsets);
  const measuredHeights = useSharedValue<RowHeightMap>(rowHeights);
  const slotAnimationsEnabled = useSharedValue(false);
  const totalHeight = useSharedValue(metrics.totalHeight);
  const draggingRowIdRef = useRef<DashboardCardId | null>(null);
  const pendingRowHeightsRef = useRef<RowHeightMap>({});
  const rowHeightFlushFrameRef = useRef<number | null>(null);
  const [draggingRowId, setDraggingRowId] = useState<DashboardCardId | null>(null);
  const autoScroll = useReorderAutoScroll();

  const clearRowHeightFlushFrame = useCallback(() => {
    if (rowHeightFlushFrameRef.current !== null) {
      cancelAnimationFrame(rowHeightFlushFrameRef.current);
      rowHeightFlushFrameRef.current = null;
    }
  }, []);

  const flushPendingRowHeights = useCallback(() => {
    clearRowHeightFlushFrame();
    const pendingHeights = pendingRowHeightsRef.current;
    pendingRowHeightsRef.current = {};

    if (!Object.keys(pendingHeights).length) {
      return;
    }

    setRowHeights((currentHeights) => {
      let didChange = false;
      const nextHeights = { ...currentHeights };

      for (const [rowId, height] of Object.entries(pendingHeights)) {
        const currentHeight = currentHeights[rowId];
        if (currentHeight !== undefined && Math.abs(currentHeight - height) < 1) {
          continue;
        }

        nextHeights[rowId] = height;
        didChange = true;
      }

      return didChange ? nextHeights : currentHeights;
    });
  }, [clearRowHeightFlushFrame]);

  const scheduleRowHeightFlushFrame = useCallback(() => {
    if (rowHeightFlushFrameRef.current !== null) {
      return;
    }

    rowHeightFlushFrameRef.current = requestAnimationFrame(() => {
      rowHeightFlushFrameRef.current = null;
      flushPendingRowHeights();
    });
  }, [flushPendingRowHeights]);

  useEffect(() => {
    draggingRowIdRef.current = draggingRowId;
  }, [draggingRowId]);

  useEffect(() => clearRowHeightFlushFrame, [clearRowHeightFlushFrame]);

  useEffect(() => {
    rowIdsRef.current = rowIds;
    measuredHeights.value = rowHeights;

    if (!draggingRowId) {
      orderIds.value = rowIds;
      rowOffsets.value = metrics.offsets;
      totalHeight.value = metrics.totalHeight;
    }
  }, [
    draggingRowId,
    measuredHeights,
    metrics.offsets,
    metrics.totalHeight,
    orderIds,
    rowHeights,
    rowIds,
    rowOffsets,
    totalHeight,
  ]);

  const handleRowLayout = useCallback((rowId: DashboardCardId, height: number) => {
    if (height <= 0) {
      return;
    }

    measuredHeights.value = {
      ...measuredHeights.value,
      [rowId]: height,
    };

    pendingRowHeightsRef.current = {
      ...pendingRowHeightsRef.current,
      [rowId]: height,
    };

    if (!draggingRowIdRef.current) {
      scheduleRowHeightFlushFrame();
    }
  }, [measuredHeights, scheduleRowHeightFlushFrame]);

  const handleDragStart = useCallback((rowId: DashboardCardId) => {
    setDraggingRowId(rowId);
    onDragBegin?.(rowId);
  }, [onDragBegin]);

  const handleDragFinish = useCallback((nextOrderIds: DashboardCardId[]) => {
    setDraggingRowId(null);
    flushPendingRowHeights();
    onDragEnd(mergeVisibleReorderIds(rowIdsRef.current, nextOrderIds));
  }, [flushPendingRowHeights, onDragEnd]);

  return (
    <ScrollView
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={autoScroll.onContentSizeChange}
      onLayout={autoScroll.onLayout}
      onScroll={autoScroll.onScroll}
      ref={autoScroll.scrollRef}
      scrollEventThrottle={16}
      scrollEnabled={!draggingRowId}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
      testID="dashboard-edit-card-list"
    >
      {headerComponent}
      {rows.length ? (
        <View style={[styles.canvas, { height: metrics.totalHeight }]}>
          {rows.map((row, index) => (
            <DashboardCardReorderItem
              key={row.id}
              activeRowId={activeRowId}
              dragTop={dragTop}
              dragging={draggingRowId === row.id}
              index={index}
              measuredHeights={measuredHeights}
              orderIds={orderIds}
              reorderActive={draggingRowId !== null}
              row={row}
              rowOffsets={rowOffsets}
              scrollOffset={autoScroll.scrollOffset}
              slotAnimationsEnabled={slotAnimationsEnabled}
              totalHeight={totalHeight}
              onAutoScrollStart={autoScroll.start}
              onAutoScrollStop={autoScroll.stop}
              onAutoScrollTouch={autoScroll.updateTouch}
              onDragFinish={handleDragFinish}
              onDragStart={handleDragStart}
              onLayout={handleRowLayout}
              renderRow={renderRow}
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

type DashboardCardReorderItemProps = {
  activeRowId: SharedValue<DashboardCardId | null>;
  dragTop: SharedValue<number>;
  dragging: boolean;
  index: number;
  measuredHeights: SharedValue<RowHeightMap>;
  orderIds: SharedValue<DashboardCardId[]>;
  reorderActive: boolean;
  row: DashboardCardSetting;
  rowOffsets: SharedValue<RowOffsetMap>;
  scrollOffset: SharedValue<number>;
  slotAnimationsEnabled: SharedValue<boolean>;
  totalHeight: SharedValue<number>;
  renderRow: (row: DashboardCardSetting, state: DashboardCardReorderRenderState) => ReactNode;
  onAutoScrollStart: (absoluteY: number) => void;
  onAutoScrollStop: () => void;
  onAutoScrollTouch: (absoluteY: number) => void;
  onDragFinish: (cardIds: DashboardCardId[]) => void;
  onDragStart: (cardId: DashboardCardId) => void;
  onLayout: (cardId: DashboardCardId, height: number) => void;
};

function DashboardCardReorderItem({
  activeRowId,
  dragTop,
  dragging,
  index,
  measuredHeights,
  orderIds,
  reorderActive,
  row,
  rowOffsets,
  scrollOffset,
  slotAnimationsEnabled,
  totalHeight,
  renderRow,
  onAutoScrollStart,
  onAutoScrollStop,
  onAutoScrollTouch,
  onDragFinish,
  onDragStart,
  onLayout,
}: DashboardCardReorderItemProps) {
  const startTop = useSharedValue(index * DASHBOARD_CARD_REORDER_FALLBACK_ROW_HEIGHT);
  const releaseScheduled = useSharedValue(false);
  const dragArmed = useSharedValue(false);
  const dragActive = useSharedValue(false);
  const latestTouchAbsoluteY = useSharedValue(0);
  const activationTouchAbsoluteY = useSharedValue(0);
  const activationScrollOffset = useSharedValue(0);
  const activationTranslationY = useSharedValue(0);

  const updateDragPosition = useCallback((touchOffsetY: number) => {
    'worklet';
    if (!dragActive.value || activeRowId.value !== row.id) {
      return;
    }

    const contentOffsetY = touchOffsetY + scrollOffset.value - activationScrollOffset.value;
    const activeHeight = measuredHeights.value[row.id] ?? DASHBOARD_CARD_REORDER_FALLBACK_ROW_HEIGHT;
    const maxTop = Math.max(totalHeight.value - activeHeight, 0);
    const nextTop = Math.min(Math.max(startTop.value + contentOffsetY, 0), maxTop);
    const movingDown = nextTop >= dragTop.value;
    if (Math.abs(nextTop - startTop.value) > 0.5) {
      slotAnimationsEnabled.value = true;
    }
    dragTop.value = nextTop;

    const activeThresholdY = movingDown ? nextTop + activeHeight : nextTop;
    const currentOrderIds = orderIds.value;
    let targetIndex = 0;
    let fallbackTop = 0;

    for (let itemIndex = 0; itemIndex < currentOrderIds.length; itemIndex += 1) {
      const id = currentOrderIds[itemIndex];
      const itemHeight = measuredHeights.value[id] ?? DASHBOARD_CARD_REORDER_FALLBACK_ROW_HEIGHT;
      const itemTop = rowOffsets.value[id] ?? fallbackTop;

      if (id === row.id) {
        fallbackTop += itemHeight;
        continue;
      }

      if (activeThresholdY > itemTop + itemHeight / 2) {
        targetIndex += 1;
      }

      fallbackTop += itemHeight;
    }

    targetIndex = Math.min(Math.max(targetIndex, 0), Math.max(currentOrderIds.length - 1, 0));
    const currentIndex = currentOrderIds.indexOf(row.id);
    if (targetIndex === currentIndex) {
      return;
    }

    const withoutActiveId: DashboardCardId[] = [];
    for (let itemIndex = 0; itemIndex < currentOrderIds.length; itemIndex += 1) {
      const id = currentOrderIds[itemIndex];
      if (id !== row.id) {
        withoutActiveId.push(id);
      }
    }

    const nextOrderIds = [...withoutActiveId];
    nextOrderIds.splice(targetIndex, 0, row.id);

    const nextOffsets: RowOffsetMap = {};
    let nextTotalHeight = 0;
    for (let itemIndex = 0; itemIndex < nextOrderIds.length; itemIndex += 1) {
      const id = nextOrderIds[itemIndex];
      nextOffsets[id] = nextTotalHeight;
      nextTotalHeight += measuredHeights.value[id] ?? DASHBOARD_CARD_REORDER_FALLBACK_ROW_HEIGHT;
    }

    orderIds.value = nextOrderIds;
    rowOffsets.value = nextOffsets;
    totalHeight.value = nextTotalHeight;
  }, [
    activationScrollOffset,
    activeRowId,
    dragActive,
    dragTop,
    measuredHeights,
    orderIds,
    row.id,
    rowOffsets,
    scrollOffset,
    slotAnimationsEnabled,
    startTop,
    totalHeight,
  ]);

  useAnimatedReaction(
    () => scrollOffset.value,
    (currentOffset, previousOffset) => {
      if (previousOffset === null || Math.abs(currentOffset - previousOffset) < 0.5) {
        return;
      }

      updateDragPosition(latestTouchAbsoluteY.value - activationTouchAbsoluteY.value);
    },
    [activationTouchAbsoluteY, latestTouchAbsoluteY, scrollOffset, updateDragPosition],
  );

  const gesture = useMemo(
    () => {
      const getTouchAbsoluteY = (touches: readonly { absoluteY: number }[]) => {
        'worklet';
        const touch = touches[0];
        return touch ? touch.absoluteY : null;
      };

      const getRowHeight = (rowId: string) => {
        'worklet';
        return measuredHeights.value[rowId] ?? DASHBOARD_CARD_REORDER_FALLBACK_ROW_HEIGHT;
      };

      const rebuildOffsets = (nextOrderIds: DashboardCardId[]) => {
        'worklet';
        const nextOffsets: RowOffsetMap = {};
        let nextTotalHeight = 0;

        for (let itemIndex = 0; itemIndex < nextOrderIds.length; itemIndex += 1) {
          const id = nextOrderIds[itemIndex];
          nextOffsets[id] = nextTotalHeight;
          nextTotalHeight += getRowHeight(id);
        }

        orderIds.value = nextOrderIds;
        rowOffsets.value = nextOffsets;
        totalHeight.value = nextTotalHeight;
      };

      const armDrag = () => {
        'worklet';
        activeRowId.value = row.id;
        slotAnimationsEnabled.value = false;
        dragArmed.value = true;
        dragActive.value = false;
        releaseScheduled.value = false;
        activationTouchAbsoluteY.value = latestTouchAbsoluteY.value;
        activationScrollOffset.value = scrollOffset.value;
        activationTranslationY.value = 0;
        rebuildOffsets(orderIds.value);
        startTop.value = rowOffsets.value[row.id] ?? index * DASHBOARD_CARD_REORDER_FALLBACK_ROW_HEIGHT;
        cancelAnimation(dragTop);
        dragTop.value = startTop.value;
        runOnJS(onDragStart)(row.id);
      };

      const finishDrag = () => {
        'worklet';
        if (!dragArmed.value || activeRowId.value !== row.id) {
          return;
        }

        releaseScheduled.value = true;
        dragArmed.value = false;
        dragActive.value = false;
        slotAnimationsEnabled.value = true;
        const finalTop = rowOffsets.value[row.id] ?? startTop.value;
        dragTop.value = withTiming(finalTop, DASHBOARD_CARD_REORDER_SLOT_ANIMATION, (finished) => {
          if (!finished) {
            return;
          }

          activeRowId.value = null;
          runOnJS(onAutoScrollStop)();
          runOnJS(onDragFinish)([...orderIds.value]);
        });
      };

      const cancelDrag = () => {
        'worklet';
        if (releaseScheduled.value || activeRowId.value !== row.id) {
          return;
        }

        dragArmed.value = false;
        dragActive.value = false;
        slotAnimationsEnabled.value = false;
        activeRowId.value = null;
        runOnJS(onAutoScrollStop)();
        runOnJS(onDragFinish)([...orderIds.value]);
      };

      const longPressGesture = Gesture.LongPress()
        .minDuration(DASHBOARD_CARD_REORDER_ACTIVATION_MS)
        .maxDistance(100000)
        .shouldCancelWhenOutside(false)
        .cancelsTouchesInView(false)
        .onStart((event) => {
          latestTouchAbsoluteY.value = event.absoluteY;
          armDrag();
        })
        .onEnd(finishDrag)
        .onFinalize((_event, success) => {
          if (success) {
            return;
          }

          cancelDrag();
        });

      const panGesture = Gesture.Pan()
        .manualActivation(true)
        .minDistance(0)
        .averageTouches(true)
        .shouldCancelWhenOutside(false)
        .cancelsTouchesInView(false)
        .onTouchesDown((event) => {
          const absoluteY = getTouchAbsoluteY(event.allTouches.length ? event.allTouches : event.changedTouches);
          if (absoluteY === null) {
            return;
          }

          latestTouchAbsoluteY.value = absoluteY;
        })
        .onTouchesMove((event, stateManager) => {
          const absoluteY = getTouchAbsoluteY(event.allTouches.length ? event.allTouches : event.changedTouches);
          if (absoluteY !== null) {
            latestTouchAbsoluteY.value = absoluteY;
            runOnJS(onAutoScrollTouch)(absoluteY);
          }

          if (dragArmed.value && !dragActive.value && activeRowId.value === row.id) {
            dragActive.value = true;
            stateManager.activate();
            runOnJS(onAutoScrollStart)(latestTouchAbsoluteY.value);
          }

          if (dragArmed.value && activeRowId.value === row.id) {
            updateDragPosition(latestTouchAbsoluteY.value - activationTouchAbsoluteY.value);
          }
        })
        .onStart((event) => {
          if (!dragArmed.value || activeRowId.value !== row.id) {
            return;
          }

          dragActive.value = true;
          activationTranslationY.value = event.translationY;
          runOnJS(onAutoScrollStart)(event.absoluteY);
        })
        .onUpdate((event) => {
          latestTouchAbsoluteY.value = event.absoluteY;
          runOnJS(onAutoScrollTouch)(event.absoluteY);
          updateDragPosition(event.translationY - activationTranslationY.value);
        })
        .onEnd(finishDrag)
        .onFinalize((_event, success) => {
          if (success) {
            return;
          }

          cancelDrag();
        });

      return Gesture.Simultaneous(longPressGesture, panGesture);
    },
    [
      activeRowId,
      activationScrollOffset,
      activationTouchAbsoluteY,
      activationTranslationY,
      dragActive,
      dragArmed,
      dragTop,
      index,
      latestTouchAbsoluteY,
      measuredHeights,
      onAutoScrollStart,
      onAutoScrollStop,
      onAutoScrollTouch,
      onDragFinish,
      onDragStart,
      orderIds,
      releaseScheduled,
      row.id,
      rowOffsets,
      scrollOffset,
      slotAnimationsEnabled,
      startTop,
      totalHeight,
      updateDragPosition,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const slotTop = rowOffsets.value[row.id] ?? index * DASHBOARD_CARD_REORDER_FALLBACK_ROW_HEIGHT;

    if (!reorderActive) {
      return {
        elevation: 0,
        transform: [{ translateY: slotTop }],
        zIndex: 1,
      };
    }

    const isActive = activeRowId.value === row.id;
    return {
      elevation: isActive ? 12 : 0,
      transform: [
        {
          translateY: isActive
            ? dragTop.value
            : slotAnimationsEnabled.value
              ? withTiming(slotTop, DASHBOARD_CARD_REORDER_SLOT_ANIMATION)
              : slotTop,
        },
      ],
      zIndex: isActive ? 20 : 1,
    };
  }, [activeRowId, dragTop, index, reorderActive, row.id, rowOffsets, slotAnimationsEnabled]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        collapsable={false}
        onLayout={(event) => onLayout(row.id, event.nativeEvent.layout.height)}
        style={[styles.item, animatedStyle]}
      >
        {renderRow(row, { dragging, reorderActive })}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  canvas: {
    position: 'relative',
    width: '100%',
  },
  item: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: '100%',
  },
});
