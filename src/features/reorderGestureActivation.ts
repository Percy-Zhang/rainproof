import { Gesture } from 'react-native-gesture-handler';

export const REORDER_PRE_ACTIVATION_MOVE_THRESHOLD = 12;

export const REORDER_TOUCH_INTENT = {
  idle: 0,
  pending: 1,
  scroll: 2,
  reorder: 3,
} as const;

export type ReorderTouchIntent = typeof REORDER_TOUCH_INTENT[keyof typeof REORDER_TOUCH_INTENT];

export type ReorderPressGuard = {
  beginTouchSession: () => void;
  shouldSuppressPress: () => boolean;
  suppressPress: () => void;
};

export function createReorderLongPressGesture(minDurationMs: number) {
  return Gesture.LongPress()
    .minDuration(minDurationMs)
    .maxDistance(REORDER_PRE_ACTIVATION_MOVE_THRESHOLD)
    .shouldCancelWhenOutside(false)
    .cancelsTouchesInView(true);
}

export function createReorderNativeScrollGesture() {
  return Gesture.Native();
}

export function createReorderPressGuard(): ReorderPressGuard {
  let pressSuppressed = false;

  return {
    beginTouchSession: () => {
      pressSuppressed = false;
    },
    shouldSuppressPress: () => pressSuppressed,
    suppressPress: () => {
      pressSuppressed = true;
    },
  };
}

export function hasExceededReorderPreActivationMovement({
  currentX,
  currentY,
  startX,
  startY,
}: {
  currentX: number;
  currentY: number;
  startX: number;
  startY: number;
}): boolean {
  'worklet';
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  return deltaX * deltaX + deltaY * deltaY > REORDER_PRE_ACTIVATION_MOVE_THRESHOLD ** 2;
}

export function shouldCancelPendingReorderForMovement({
  currentX,
  currentY,
  intent,
  startX,
  startY,
}: {
  currentX: number;
  currentY: number;
  intent: ReorderTouchIntent;
  startX: number;
  startY: number;
}): boolean {
  'worklet';
  return intent === REORDER_TOUCH_INTENT.pending && hasExceededReorderPreActivationMovement({
    currentX,
    currentY,
    startX,
    startY,
  });
}

export function getReorderTouchIntentAfterMovement({
  currentX,
  currentY,
  intent,
  startX,
  startY,
}: {
  currentX: number;
  currentY: number;
  intent: ReorderTouchIntent;
  startX: number;
  startY: number;
}): ReorderTouchIntent {
  'worklet';
  return shouldCancelPendingReorderForMovement({
    currentX,
    currentY,
    intent,
    startX,
    startY,
  })
    ? REORDER_TOUCH_INTENT.scroll
    : intent;
}

export function canActivateReorderFromTouchIntent(intent: ReorderTouchIntent): boolean {
  'worklet';
  return intent === REORDER_TOUCH_INTENT.pending;
}

export function shouldSuppressPressForReorderTouchIntent(intent: ReorderTouchIntent): boolean {
  'worklet';
  return intent === REORDER_TOUCH_INTENT.scroll || intent === REORDER_TOUCH_INTENT.reorder;
}

export function shouldFinishReorderFromLongPress({
  dragActive,
  dragArmed,
  success,
}: {
  dragActive: boolean;
  dragArmed: boolean;
  success: boolean;
}): boolean {
  'worklet';
  return success && dragArmed && !dragActive;
}

export function shouldCancelReorderFromLongPressFinalize({
  dragArmed,
  success,
}: {
  dragArmed: boolean;
  success: boolean;
}): boolean {
  'worklet';
  return !success && !dragArmed;
}
