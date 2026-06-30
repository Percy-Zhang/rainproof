import { useCallback, useRef } from 'react';

export function useDeferredOrderPersistence(
  onPersistOrder: (orderedIds: string[]) => Promise<void>,
) {
  const frameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledPersistence = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // A visually accepted drop should still persist if the user leaves the screen
  // before the next frame runs; the scheduled task does not touch local state.
  return useCallback((orderedIds: string[]) => {
    const nextOrderedIds = [...orderedIds];
    cancelScheduledPersistence();

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        void onPersistOrder(nextOrderedIds);
      }, 0);
    });
  }, [cancelScheduledPersistence, onPersistOrder]);
}
