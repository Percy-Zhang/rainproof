import {
  REORDER_PRE_ACTIVATION_MOVE_THRESHOLD,
  REORDER_TOUCH_INTENT,
  canActivateReorderFromTouchIntent,
  createReorderLongPressGesture,
  createReorderNativeScrollGesture,
  createReorderPressGuard,
  getReorderTouchIntentAfterMovement,
  hasExceededReorderPreActivationMovement,
  shouldCancelPendingReorderForMovement,
  shouldCancelReorderFromLongPressFinalize,
  shouldFinishReorderFromLongPress,
  shouldSuppressPressForReorderTouchIntent,
} from '../reorderGestureActivation';

describe('reorder gesture activation', () => {
  it('configures native long press cancellation without changing the requested hold duration', () => {
    const gesture = createReorderLongPressGesture(150);

    expect(gesture.config.minDurationMs).toBe(150);
    expect(gesture.config.maxDist).toBe(REORDER_PRE_ACTIVATION_MOVE_THRESHOLD);
    expect(gesture.config.shouldCancelWhenOutside).toBe(false);
    expect(gesture.config.cancelsTouchesInView).toBe(true);
  });

  it('creates a native gesture for explicit ScrollView coordination', () => {
    expect(createReorderNativeScrollGesture().handlerName).toBe('NativeViewGestureHandler');
  });

  it('keeps long press callbacks consistently on the UI thread', () => {
    const callback = () => {
      'worklet';
    };
    const gesture = createReorderLongPressGesture(150)
      .onStart(callback)
      .onEnd(callback)
      .onFinalize(callback);

    expect(gesture.handlers.isWorklet.filter((value) => value !== undefined)).toEqual([true, true, true]);
    expect(gesture.config.runOnJS).not.toBe(true);
  });

  it('allows ordinary finger jitter while a deliberate long press is pending', () => {
    expect(hasExceededReorderPreActivationMovement({
      currentX: 105,
      currentY: 107,
      startX: 100,
      startY: 100,
    })).toBe(false);
  });

  it('cancels pending reorder intent after meaningful movement', () => {
    expect(hasExceededReorderPreActivationMovement({
      currentX: 100,
      currentY: 100 + REORDER_PRE_ACTIVATION_MOVE_THRESHOLD + 1,
      startX: 100,
      startY: 100,
    })).toBe(true);
  });

  it('uses radial movement so diagonal scroll intent is cancelled consistently', () => {
    expect(hasExceededReorderPreActivationMovement({
      currentX: 109,
      currentY: 109,
      startX: 100,
      startY: 100,
    })).toBe(true);
  });

  it('applies the movement threshold only before drag activation', () => {
    const movement = {
      currentX: 100,
      currentY: 140,
      startX: 100,
      startY: 100,
    };

    expect(shouldCancelPendingReorderForMovement({
      intent: REORDER_TOUCH_INTENT.pending,
      ...movement,
    })).toBe(true);
    expect(shouldCancelPendingReorderForMovement({
      intent: REORDER_TOUCH_INTENT.reorder,
      ...movement,
    })).toBe(false);
  });

  it('latches scroll intent after movement even if the touch returns to its origin', () => {
    const scrollIntent = getReorderTouchIntentAfterMovement({
      currentX: 100,
      currentY: 113,
      intent: REORDER_TOUCH_INTENT.pending,
      startX: 100,
      startY: 100,
    });

    expect(scrollIntent).toBe(REORDER_TOUCH_INTENT.scroll);
    expect(getReorderTouchIntentAfterMovement({
      currentX: 100,
      currentY: 100,
      intent: scrollIntent,
      startX: 100,
      startY: 100,
    })).toBe(REORDER_TOUCH_INTENT.scroll);
    expect(canActivateReorderFromTouchIntent(scrollIntent)).toBe(false);
    expect(shouldSuppressPressForReorderTouchIntent(scrollIntent)).toBe(true);
  });

  it('keeps tap eligible only for a pending touch with no meaningful movement', () => {
    const intent = getReorderTouchIntentAfterMovement({
      currentX: 104,
      currentY: 105,
      intent: REORDER_TOUCH_INTENT.pending,
      startX: 100,
      startY: 100,
    });

    expect(intent).toBe(REORDER_TOUCH_INTENT.pending);
    expect(canActivateReorderFromTouchIntent(intent)).toBe(true);
    expect(shouldSuppressPressForReorderTouchIntent(intent)).toBe(false);
  });

  it('suppresses row actions for the rest of a scroll or reorder touch session', () => {
    const pressGuard = createReorderPressGuard();

    pressGuard.beginTouchSession();
    expect(pressGuard.shouldSuppressPress()).toBe(false);

    pressGuard.suppressPress();
    expect(pressGuard.shouldSuppressPress()).toBe(true);
    expect(pressGuard.shouldSuppressPress()).toBe(true);

    pressGuard.beginTouchSession();
    expect(pressGuard.shouldSuppressPress()).toBe(false);
  });

  it('suppresses taps once reorder intent activates', () => {
    expect(canActivateReorderFromTouchIntent(REORDER_TOUCH_INTENT.pending)).toBe(true);
    expect(canActivateReorderFromTouchIntent(REORDER_TOUCH_INTENT.scroll)).toBe(false);
    expect(shouldSuppressPressForReorderTouchIntent(REORDER_TOUCH_INTENT.reorder)).toBe(true);
  });

  it('lets the manual pan own active movement even if LongPress later fails', () => {
    expect(shouldCancelReorderFromLongPressFinalize({
      dragArmed: true,
      success: false,
    })).toBe(false);
    expect(shouldFinishReorderFromLongPress({
      dragActive: true,
      dragArmed: true,
      success: true,
    })).toBe(false);
  });

  it('finishes stationary long presses and safely cancels pre-activation failures', () => {
    expect(shouldFinishReorderFromLongPress({
      dragActive: false,
      dragArmed: true,
      success: true,
    })).toBe(true);
    expect(shouldCancelReorderFromLongPressFinalize({
      dragArmed: false,
      success: false,
    })).toBe(true);
  });
});
