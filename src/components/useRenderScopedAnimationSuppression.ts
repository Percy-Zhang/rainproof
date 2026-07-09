import { useCallback, useEffect, useRef, useState } from 'react';

export function useRenderScopedAnimationSuppression() {
  const [suppressionToken, setSuppressionToken] = useState(0);
  const latestSuppressionTokenRef = useRef(0);
  const clearFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const cancelClearFrame = useCallback(() => {
    if (clearFrameRef.current !== null) {
      cancelAnimationFrame(clearFrameRef.current);
      clearFrameRef.current = null;
    }
  }, []);

  const suppressNextRenderAnimations = useCallback(() => {
    cancelClearFrame();
    const nextToken = latestSuppressionTokenRef.current + 1;
    latestSuppressionTokenRef.current = nextToken;
    setSuppressionToken(nextToken);
  }, [cancelClearFrame]);

  useEffect(() => {
    if (suppressionToken === 0) {
      return undefined;
    }

    const tokenForThisRender = suppressionToken;
    clearFrameRef.current = requestAnimationFrame(() => {
      clearFrameRef.current = null;
      if (!mountedRef.current || latestSuppressionTokenRef.current !== tokenForThisRender) {
        return;
      }

      setSuppressionToken((currentToken) => (currentToken === tokenForThisRender ? 0 : currentToken));
    });

    return cancelClearFrame;
  }, [cancelClearFrame, suppressionToken]);

  useEffect(() => () => {
    mountedRef.current = false;
    latestSuppressionTokenRef.current += 1;
    cancelClearFrame();
  }, [cancelClearFrame]);

  return {
    suppressAnimations: suppressionToken !== 0,
    suppressNextRenderAnimations,
  };
}
