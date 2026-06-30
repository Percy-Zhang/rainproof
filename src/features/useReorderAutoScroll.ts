import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  type HostInstance,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';

const REORDER_AUTO_SCROLL_EDGE_ZONE = 80;
const REORDER_AUTO_SCROLL_MAX_SPEED = 18;

type ReorderAutoScroll = {
  onContentSizeChange: (_width: number, height: number) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollOffset: SharedValue<number>;
  scrollRef: RefObject<ScrollView | null>;
  start: (absoluteY: number) => void;
  stop: () => void;
  updateTouch: (absoluteY: number) => void;
};

export function useReorderAutoScroll(): ReorderAutoScroll {
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollOffset = useSharedValue(0);
  const activeRef = useRef(false);
  const contentHeightRef = useRef(0);
  const frameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const latestTouchAbsoluteYRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const viewportHeightRef = useRef(0);
  const viewportTopRef = useRef(0);

  const measureViewport = useCallback(() => {
    const scrollHost: HostInstance | null | undefined = scrollRef.current?.getNativeScrollRef();
    scrollHost?.measureInWindow((_x: number, y: number, _width: number, height: number) => {
      viewportTopRef.current = y;
      if (height > 0) {
        viewportHeightRef.current = height;
      }
    });
  }, []);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const runFrame = useCallback(() => {
    frameRef.current = null;
    if (!activeRef.current) {
      return;
    }

    const viewportHeight = viewportHeightRef.current;
    const maxScrollOffset = Math.max(contentHeightRef.current - viewportHeight, 0);
    if (viewportHeight <= 0 || maxScrollOffset <= 0) {
      return;
    }

    const touchY = latestTouchAbsoluteYRef.current - viewportTopRef.current;
    const speed = getReorderAutoScrollSpeed(touchY, viewportHeight);
    if (speed === 0) {
      return;
    }

    const nextOffset = clamp(scrollOffsetRef.current + speed, 0, maxScrollOffset);
    if (Math.abs(nextOffset - scrollOffsetRef.current) >= 0.5) {
      scrollOffsetRef.current = nextOffset;
      scrollOffset.value = nextOffset;
      scrollRef.current?.scrollTo({ animated: false, y: nextOffset });
    }

    frameRef.current = requestAnimationFrame(runFrame);
  }, [scrollOffset]);

  const ensureFrame = useCallback(() => {
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(runFrame);
    }
  }, [runFrame]);

  const stop = useCallback(() => {
    activeRef.current = false;
    cancelFrame();
  }, [cancelFrame]);

  const start = useCallback((absoluteY: number) => {
    activeRef.current = true;
    latestTouchAbsoluteYRef.current = absoluteY;
    measureViewport();
    ensureFrame();
  }, [ensureFrame, measureViewport]);

  const updateTouch = useCallback((absoluteY: number) => {
    if (!activeRef.current) {
      return;
    }

    latestTouchAbsoluteYRef.current = absoluteY;
    ensureFrame();
  }, [ensureFrame]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeightRef.current = event.nativeEvent.layout.height;
    requestAnimationFrame(measureViewport);
  }, [measureViewport]);

  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeightRef.current = height;
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextOffset = event.nativeEvent.contentOffset.y;
    scrollOffsetRef.current = nextOffset;
    scrollOffset.value = nextOffset;
  }, [scrollOffset]);

  useEffect(() => stop, [stop]);

  return {
    onContentSizeChange: handleContentSizeChange,
    onLayout: handleLayout,
    onScroll: handleScroll,
    scrollOffset,
    scrollRef,
    start,
    stop,
    updateTouch,
  };
}

function getReorderAutoScrollSpeed(touchY: number, viewportHeight: number): number {
  if (touchY < REORDER_AUTO_SCROLL_EDGE_ZONE) {
    const intensity = (REORDER_AUTO_SCROLL_EDGE_ZONE - Math.max(touchY, 0)) / REORDER_AUTO_SCROLL_EDGE_ZONE;
    return -REORDER_AUTO_SCROLL_MAX_SPEED * intensity;
  }

  const bottomDistance = viewportHeight - touchY;
  if (bottomDistance < REORDER_AUTO_SCROLL_EDGE_ZONE) {
    const intensity = (REORDER_AUTO_SCROLL_EDGE_ZONE - Math.max(bottomDistance, 0)) / REORDER_AUTO_SCROLL_EDGE_ZONE;
    return REORDER_AUTO_SCROLL_MAX_SPEED * intensity;
  }

  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
