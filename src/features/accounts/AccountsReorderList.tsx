import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { Account } from '../../domain/types';
import { spacing } from '../../theme/tokens';
import {
  REORDER_TOUCH_INTENT,
  canActivateReorderFromTouchIntent,
  createReorderLongPressGesture,
  createReorderNativeScrollGesture,
  createReorderPressGuard,
  getReorderTouchIntentAfterMovement,
  shouldCancelReorderFromLongPressFinalize,
  shouldFinishReorderFromLongPress,
  type ReorderTouchIntent,
} from '../reorderGestureActivation';
import { useReorderAutoScroll } from '../useReorderAutoScroll';
import { AccountListRow } from './AccountListRow';

const ACCOUNT_ROW_HEIGHT = 84;
const ACCOUNT_ROW_FRAME_HEIGHT = ACCOUNT_ROW_HEIGHT + spacing.sm;
const ACCOUNT_REORDER_ACTIVATION_MS = 150;
const ACCOUNT_REORDER_SETTLE_MS = 150;
const ACCOUNT_REORDER_SLOT_ANIMATION = {
  duration: ACCOUNT_REORDER_SETTLE_MS,
  easing: Easing.out(Easing.cubic),
};

type AccountPositionMap = Record<string, number>;

type AccountsReorderListProps = {
  accounts: Account[];
  balanceByAccountId: Map<string, number>;
  dashboardEditMode: boolean;
  showCurrencyCodes: boolean;
  onDragBegin: () => void;
  onDragEnd: (accountIds: string[]) => void;
  onPressAccount: (account: Account) => void;
};

export function AccountsReorderList({
  accounts,
  balanceByAccountId,
  dashboardEditMode,
  showCurrencyCodes,
  onDragBegin,
  onDragEnd,
  onPressAccount,
}: AccountsReorderListProps) {
  const accountIds = useMemo(() => accounts.map((account) => account.id), [accounts]);
  const positionMap = useMemo(() => getAccountPositionMap(accounts), [accounts]);
  const accountIdsRef = useRef(accountIds);
  const activeAccountId = useSharedValue<string | null>(null);
  const dragTop = useSharedValue(0);
  const positions = useSharedValue<AccountPositionMap>(positionMap);
  const [draggingAccountId, setDraggingAccountId] = useState<string | null>(null);
  const autoScroll = useReorderAutoScroll();
  const nativeScrollGesture = useMemo(() => createReorderNativeScrollGesture(), []);

  useEffect(() => {
    accountIdsRef.current = accountIds;
    if (!draggingAccountId) {
      positions.value = positionMap;
    }
  }, [accountIds, draggingAccountId, positionMap, positions]);

  const handleDragStart = useCallback((accountId: string) => {
    setDraggingAccountId(accountId);
    onDragBegin();
  }, [onDragBegin]);

  const handleDragFinish = useCallback((nextPositions: AccountPositionMap) => {
    const nextIds = getAccountIdsByPosition(accountIdsRef.current, nextPositions);
    setDraggingAccountId(null);
    onDragEnd(nextIds);
  }, [onDragEnd]);

  return (
    <GestureDetector gesture={nativeScrollGesture}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={autoScroll.onContentSizeChange}
        onLayout={autoScroll.onLayout}
        onScroll={autoScroll.onScroll}
        ref={autoScroll.scrollRef}
        scrollEventThrottle={16}
        scrollEnabled={!draggingAccountId}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={[styles.canvas, { height: accounts.length * ACCOUNT_ROW_FRAME_HEIGHT }]}>
          {accounts.map((account, index) => (
            <AccountReorderItem
              key={account.id}
              account={account}
              accountIds={accountIds}
              activeAccountId={activeAccountId}
              balanceMinor={balanceByAccountId.get(account.id)}
              dashboardEditMode={dashboardEditMode}
              dragTop={dragTop}
              dragging={draggingAccountId === account.id}
              index={index}
              nativeScrollGesture={nativeScrollGesture}
              scrollOffset={autoScroll.scrollOffset}
              positions={positions}
              showCurrencyCodes={showCurrencyCodes}
              onAutoScrollStart={autoScroll.start}
              onAutoScrollStop={autoScroll.stop}
              onAutoScrollTouch={autoScroll.updateTouch}
              onDragFinish={handleDragFinish}
              onDragStart={handleDragStart}
              onPress={() => onPressAccount(account)}
            />
          ))}
        </View>
      </ScrollView>
    </GestureDetector>
  );
}

type AccountReorderItemProps = {
  account: Account;
  accountIds: string[];
  activeAccountId: SharedValue<string | null>;
  balanceMinor: number | undefined;
  dashboardEditMode: boolean;
  dragTop: SharedValue<number>;
  dragging: boolean;
  index: number;
  nativeScrollGesture: GestureType;
  scrollOffset: SharedValue<number>;
  positions: SharedValue<AccountPositionMap>;
  showCurrencyCodes: boolean;
  onAutoScrollStart: (absoluteY: number) => void;
  onAutoScrollStop: () => void;
  onAutoScrollTouch: (absoluteY: number) => void;
  onDragFinish: (positions: AccountPositionMap) => void;
  onDragStart: (accountId: string) => void;
  onPress: () => void;
};

function AccountReorderItem({
  account,
  accountIds,
  activeAccountId,
  balanceMinor,
  dashboardEditMode,
  dragTop,
  dragging,
  index,
  nativeScrollGesture,
  scrollOffset,
  positions,
  showCurrencyCodes,
  onAutoScrollStart,
  onAutoScrollStop,
  onAutoScrollTouch,
  onDragFinish,
  onDragStart,
  onPress,
}: AccountReorderItemProps) {
  const startTop = useSharedValue(index * ACCOUNT_ROW_FRAME_HEIGHT);
  const releaseScheduled = useSharedValue(false);
  const dragArmed = useSharedValue(false);
  const dragActive = useSharedValue(false);
  const latestTouchAbsoluteY = useSharedValue(0);
  const activationTouchAbsoluteY = useSharedValue(0);
  const initialTouchAbsoluteX = useSharedValue(0);
  const initialTouchAbsoluteY = useSharedValue(0);
  const touchIntent = useSharedValue<ReorderTouchIntent>(REORDER_TOUCH_INTENT.idle);
  const activationScrollOffset = useSharedValue(0);
  const activationTranslationY = useSharedValue(0);
  const pressGuard = useRef(createReorderPressGuard()).current;

  const handlePress = useCallback(() => {
    if (!pressGuard.shouldSuppressPress()) {
      onPress();
    }
  }, [onPress, pressGuard]);

  const updateDragPosition = useCallback((touchOffsetY: number) => {
    'worklet';
    if (!dragActive.value || activeAccountId.value !== account.id) {
      return;
    }

    // Drag positions are in content coordinates; include scroll delta so auto-scroll
    // keeps the held row under the finger while the viewport moves.
    const contentOffsetY = touchOffsetY + scrollOffset.value - activationScrollOffset.value;
    const maxTop = Math.max((accountIds.length - 1) * ACCOUNT_ROW_FRAME_HEIGHT, 0);
    const nextTop = Math.min(
      Math.max(startTop.value + contentOffsetY, 0),
      maxTop,
    );
    const movingDown = nextTop >= dragTop.value;
    dragTop.value = nextTop;

    const activeThresholdY = movingDown
      ? nextTop + ACCOUNT_ROW_FRAME_HEIGHT
      : nextTop;
    let nextIndex = 0;

    for (let itemIndex = 0; itemIndex < accountIds.length; itemIndex += 1) {
      const id = accountIds[itemIndex];
      if (id === account.id) {
        continue;
      }

      const position = positions.value[id];
      if (position === undefined) {
        continue;
      }

      const rowMidpointY = position * ACCOUNT_ROW_FRAME_HEIGHT + ACCOUNT_ROW_FRAME_HEIGHT / 2;
      if (activeThresholdY > rowMidpointY) {
        nextIndex += 1;
      }
    }

    nextIndex = Math.min(Math.max(nextIndex, 0), Math.max(accountIds.length - 1, 0));
    const currentIndex = positions.value[account.id] ?? index;

    if (nextIndex === currentIndex) {
      return;
    }

    const updatedPositions = { ...positions.value };
    for (let itemIndex = 0; itemIndex < accountIds.length; itemIndex += 1) {
      const id = accountIds[itemIndex];
      if (id === account.id) {
        continue;
      }

      const position = updatedPositions[id];
      if (position === undefined) {
        continue;
      }

      if (currentIndex < nextIndex && position > currentIndex && position <= nextIndex) {
        updatedPositions[id] = position - 1;
      } else if (currentIndex > nextIndex && position >= nextIndex && position < currentIndex) {
        updatedPositions[id] = position + 1;
      }
    }

    updatedPositions[account.id] = nextIndex;
    positions.value = updatedPositions;
  }, [
    account.id,
    accountIds,
    activationScrollOffset,
    activeAccountId,
    dragActive,
    dragTop,
    index,
    positions,
    scrollOffset,
    startTop,
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
      const getTouch = (touches: readonly { absoluteX: number; absoluteY: number }[]) => {
        'worklet';
        return touches[0] ?? null;
      };

      const armDrag = () => {
        'worklet';
        if (!canActivateReorderFromTouchIntent(touchIntent.value)) {
          return;
        }

        touchIntent.value = REORDER_TOUCH_INTENT.reorder;
        scheduleOnRN(pressGuard.suppressPress);
        const currentIndex = positions.value[account.id] ?? index;
        activeAccountId.value = account.id;
        dragArmed.value = true;
        dragActive.value = false;
        releaseScheduled.value = false;
        activationTouchAbsoluteY.value = latestTouchAbsoluteY.value;
        activationScrollOffset.value = scrollOffset.value;
        activationTranslationY.value = 0;
        startTop.value = currentIndex * ACCOUNT_ROW_FRAME_HEIGHT;
        cancelAnimation(dragTop);
        dragTop.value = startTop.value;
        scheduleOnRN(onDragStart, account.id);
      };

      const finishDrag = () => {
        'worklet';
        if (!dragArmed.value || activeAccountId.value !== account.id) {
          return;
        }

        releaseScheduled.value = true;
        dragArmed.value = false;
        dragActive.value = false;
        const finalTop = (positions.value[account.id] ?? index) * ACCOUNT_ROW_FRAME_HEIGHT;
        dragTop.value = withTiming(finalTop, ACCOUNT_REORDER_SLOT_ANIMATION, (finished) => {
          if (!finished) {
            return;
          }

          activeAccountId.value = null;
          touchIntent.value = REORDER_TOUCH_INTENT.idle;
          scheduleOnRN(onAutoScrollStop);
          scheduleOnRN(onDragFinish, { ...positions.value });
        });
      };

      const cancelDrag = () => {
        'worklet';
        if (releaseScheduled.value || activeAccountId.value !== account.id) {
          return;
        }

        dragArmed.value = false;
        dragActive.value = false;
        activeAccountId.value = null;
        touchIntent.value = REORDER_TOUCH_INTENT.idle;
        scheduleOnRN(onAutoScrollStop);
        scheduleOnRN(onDragFinish, { ...positions.value });
      };

      const longPressGesture = createReorderLongPressGesture(ACCOUNT_REORDER_ACTIVATION_MS)
        .simultaneousWithExternalGesture(nativeScrollGesture)
        .onStart((event) => {
          'worklet';
          latestTouchAbsoluteY.value = event.absoluteY;
          armDrag();
        })
        .onEnd((_event, success) => {
          'worklet';
          if (shouldFinishReorderFromLongPress({
            dragActive: dragActive.value,
            dragArmed: dragArmed.value,
            success,
          })) {
            finishDrag();
          }
        })
        .onFinalize((_event, success) => {
          'worklet';
          if (!shouldCancelReorderFromLongPressFinalize({
            dragArmed: dragArmed.value,
            success,
          })) {
            return;
          }

          cancelDrag();
        });

      const panGesture = Gesture.Pan()
        .manualActivation(true)
        .minDistance(0)
        .averageTouches(true)
        .shouldCancelWhenOutside(false)
        .cancelsTouchesInView(true)
        .simultaneousWithExternalGesture(nativeScrollGesture)
        .onTouchesDown((event) => {
          'worklet';
          const touch = getTouch(event.allTouches.length ? event.allTouches : event.changedTouches);
          if (!touch) {
            return;
          }

          initialTouchAbsoluteX.value = touch.absoluteX;
          initialTouchAbsoluteY.value = touch.absoluteY;
          latestTouchAbsoluteY.value = touch.absoluteY;
          touchIntent.value = REORDER_TOUCH_INTENT.pending;
          scheduleOnRN(pressGuard.beginTouchSession);
        })
        .onTouchesMove((event, stateManager) => {
          'worklet';
          const touch = getTouch(event.allTouches.length ? event.allTouches : event.changedTouches);
          if (!touch) {
            return;
          }

          latestTouchAbsoluteY.value = touch.absoluteY;
          if (!dragArmed.value && activeAccountId.value !== account.id) {
            const nextTouchIntent = getReorderTouchIntentAfterMovement({
              currentX: touch.absoluteX,
              currentY: touch.absoluteY,
              intent: touchIntent.value,
              startX: initialTouchAbsoluteX.value,
              startY: initialTouchAbsoluteY.value,
            });
            if (
              nextTouchIntent === REORDER_TOUCH_INTENT.scroll &&
              touchIntent.value !== REORDER_TOUCH_INTENT.scroll
            ) {
              touchIntent.value = nextTouchIntent;
              scheduleOnRN(pressGuard.suppressPress);
              stateManager.fail();
            }

            return;
          }

          scheduleOnRN(onAutoScrollTouch, touch.absoluteY);

          if (dragArmed.value && !dragActive.value && activeAccountId.value === account.id) {
            dragActive.value = true;
            stateManager.activate();
            scheduleOnRN(onAutoScrollStart, latestTouchAbsoluteY.value);
          }

          if (dragArmed.value && activeAccountId.value === account.id) {
            updateDragPosition(latestTouchAbsoluteY.value - activationTouchAbsoluteY.value);
          }
        })
        .onStart((event) => {
          'worklet';
          if (!dragArmed.value || activeAccountId.value !== account.id) {
            return;
          }

          dragActive.value = true;
          activationTranslationY.value = event.translationY;
          scheduleOnRN(onAutoScrollStart, event.absoluteY);
        })
        .onUpdate((event) => {
          'worklet';
          latestTouchAbsoluteY.value = event.absoluteY;
          scheduleOnRN(onAutoScrollTouch, event.absoluteY);
          updateDragPosition(event.translationY - activationTranslationY.value);
        })
        .onEnd(finishDrag)
        .onFinalize((_event, success) => {
          'worklet';
          if (success) {
            return;
          }

          cancelDrag();
        });

      return Gesture.Simultaneous(longPressGesture, panGesture);
    },
    [
      account.id,
      activationScrollOffset,
      activationTouchAbsoluteY,
      activationTranslationY,
      activeAccountId,
      dragActive,
      dragArmed,
      dragTop,
      index,
      initialTouchAbsoluteX,
      initialTouchAbsoluteY,
      latestTouchAbsoluteY,
      nativeScrollGesture,
      onAutoScrollStart,
      onAutoScrollStop,
      onAutoScrollTouch,
      onDragFinish,
      onDragStart,
      positions,
      pressGuard,
      releaseScheduled,
      scrollOffset,
      startTop,
      touchIntent,
      updateDragPosition,
    ],
  );

  const animatedStyle = useAnimatedStyle(() => {
    const isActive = activeAccountId.value === account.id;
    const slotTop = (positions.value[account.id] ?? index) * ACCOUNT_ROW_FRAME_HEIGHT;

    return {
      elevation: isActive ? 12 : 0,
      transform: [
        {
          translateY: isActive
            ? dragTop.value
            : withTiming(slotTop, ACCOUNT_REORDER_SLOT_ANIMATION),
        },
      ],
      zIndex: isActive ? 20 : 1,
    };
  }, [account.id, activeAccountId, dragTop, index, positions]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View collapsable={false} style={[styles.item, animatedStyle]}>
        <AccountListRow
          account={account}
          balanceMinor={balanceMinor}
          dashboardEditMode={dashboardEditMode}
          dragging={dragging}
          showCurrencyCodes={showCurrencyCodes}
          onPress={handlePress}
        />
      </Animated.View>
    </GestureDetector>
  );
}

function getAccountPositionMap(accounts: readonly Account[]): AccountPositionMap {
  const positions: AccountPositionMap = {};
  accounts.forEach((account, index) => {
    positions[account.id] = index;
  });
  return positions;
}

function getAccountIdsByPosition(
  accountIds: readonly string[],
  positions: AccountPositionMap,
): string[] {
  return [...accountIds].sort((left, right) => (positions[left] ?? 0) - (positions[right] ?? 0));
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  canvas: {
    position: 'relative',
    width: '100%',
  },
  item: {
    height: ACCOUNT_ROW_FRAME_HEIGHT,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
