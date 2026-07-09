import { useCallback, useEffect, useRef, useState } from 'react';
import type { GestureResponderEvent, PressableProps } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

const INTENT_SAFE_PRESS_RETENTION_OFFSET = {
  bottom: 8,
  left: 8,
  right: 8,
  top: 8,
};
const TAP_INTENT_CANCEL_DISTANCE = 8;

export type AccountSelectionMap = Record<string, boolean>;

export function useImmediateAccountSelection({
  enabled = true,
  onApplySelectedAccountIds,
  selectedAccountIds,
}: {
  enabled?: boolean;
  onApplySelectedAccountIds: (accountIds: string[]) => void;
  selectedAccountIds: string[];
}) {
  const [visualSelectedAccountIds, setVisualSelectedAccountIdsState] = useState(() => selectedAccountIds);
  const committedSelectedAccountIdsRef = useRef(selectedAccountIds);
  const latestIntendedSelectedAccountIdsRef = useRef(selectedAccountIds);
  const pendingCommittedIntentRef = useRef<string[] | null>(null);
  const pendingPreviewIntentRef = useRef<string[] | null>(null);
  const mountedRef = useRef(true);
  const visualSelectedAccountIdMap = useSharedValue<AccountSelectionMap>(
    getAccountSelectionMap(selectedAccountIds),
  );

  const setVisualSelectedAccountIds = useCallback((nextIds: string[], updateReactState = true) => {
    const nextSelection = [...nextIds];
    latestIntendedSelectedAccountIdsRef.current = nextSelection;
    visualSelectedAccountIdMap.value = getAccountSelectionMap(nextSelection);
    if (updateReactState && mountedRef.current) {
      setVisualSelectedAccountIdsState((currentIds) =>
        areAccountSelectionsEqual(currentIds, nextSelection) ? currentIds : nextSelection,
      );
    }
  }, [visualSelectedAccountIdMap]);

  useEffect(() => {
    committedSelectedAccountIdsRef.current = selectedAccountIds;

    if (!enabled) {
      pendingCommittedIntentRef.current = null;
      pendingPreviewIntentRef.current = null;
      setVisualSelectedAccountIds(selectedAccountIds);
      return;
    }

    if (
      pendingCommittedIntentRef.current &&
      areAccountSelectionsEqual(pendingCommittedIntentRef.current, selectedAccountIds)
    ) {
      pendingCommittedIntentRef.current = null;
    }

    if (!pendingCommittedIntentRef.current && !pendingPreviewIntentRef.current) {
      setVisualSelectedAccountIds(selectedAccountIds);
    }
  }, [enabled, selectedAccountIds, setVisualSelectedAccountIds]);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  const applySelectedAccountIds = useCallback((nextIds: string[]) => {
    const nextSelection = [...nextIds];

    if (!enabled) {
      onApplySelectedAccountIds(nextSelection);
      return;
    }

    setVisualSelectedAccountIds(nextSelection);
    pendingPreviewIntentRef.current = null;
    pendingCommittedIntentRef.current = nextSelection;
    onApplySelectedAccountIds(nextSelection);
  }, [enabled, onApplySelectedAccountIds, setVisualSelectedAccountIds]);

  const previewSelectedAccountIds = useCallback((nextIds: string[]) => {
    if (!enabled) {
      return;
    }

    const nextSelection = [...nextIds];
    pendingPreviewIntentRef.current = nextSelection;
    setVisualSelectedAccountIds(nextSelection, false);
  }, [enabled, setVisualSelectedAccountIds]);

  const cancelSelectionPreview = useCallback(() => {
    if (!enabled || !pendingPreviewIntentRef.current) {
      return;
    }

    pendingPreviewIntentRef.current = null;
    setVisualSelectedAccountIds(
      pendingCommittedIntentRef.current ?? committedSelectedAccountIdsRef.current,
      false,
    );
  }, [enabled, setVisualSelectedAccountIds]);

  const commitPreviewedSelection = useCallback((fallbackSelection?: string[] | (() => string[])) => {
    const nextSelection =
      pendingPreviewIntentRef.current ??
      (typeof fallbackSelection === 'function' ? fallbackSelection() : fallbackSelection) ??
      latestIntendedSelectedAccountIdsRef.current;

    applySelectedAccountIds(nextSelection);
  }, [applySelectedAccountIds]);

  const getToggledAccountIds = useCallback((accountId: string): string[] => {
    const currentIds = latestIntendedSelectedAccountIdsRef.current;
    return currentIds.includes(accountId)
      ? currentIds.filter((id) => id !== accountId)
      : [...currentIds, accountId];
  }, []);

  const previewToggleAccount = useCallback((accountId: string) => {
    previewSelectedAccountIds(getToggledAccountIds(accountId));
  }, [getToggledAccountIds, previewSelectedAccountIds]);

  const toggleAccount = useCallback((accountId: string) => {
    applySelectedAccountIds(getToggledAccountIds(accountId));
  }, [applySelectedAccountIds, getToggledAccountIds]);

  return {
    applySelectedAccountIds,
    cancelSelectionPreview,
    commitPreviewedSelection,
    getToggledAccountIds,
    previewSelectedAccountIds,
    previewToggleAccount,
    selectedAccountIds: enabled ? visualSelectedAccountIds : selectedAccountIds,
    toggleAccount,
    visualSelectedAccountIdMap,
  };
}

export function useTapIntentPressHandlers({
  enabled,
  onCancel,
  onCommit,
  onPreview,
}: {
  enabled: boolean;
  onCancel: () => void;
  onCommit: () => void;
  onPreview: () => void;
}): Pick<
  PressableProps,
  'onPress' | 'onPressIn' | 'onPressOut' | 'onTouchCancel' | 'onTouchMove' | 'pressRetentionOffset'
> {
  const previewedRef = useRef(false);
  const committedRef = useRef(false);
  const cancelledByMovementRef = useRef(false);
  const touchStartRef = useRef<{ pageX: number; pageY: number } | null>(null);
  const cancelPreviewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCancelPreviewTimeout = useCallback(() => {
    if (cancelPreviewTimeoutRef.current) {
      clearTimeout(cancelPreviewTimeoutRef.current);
      cancelPreviewTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearCancelPreviewTimeout, [clearCancelPreviewTimeout]);

  const handlePressIn = useCallback((event: GestureResponderEvent) => {
    if (!enabled) {
      return;
    }

    clearCancelPreviewTimeout();
    committedRef.current = false;
    cancelledByMovementRef.current = false;
    previewedRef.current = true;
    touchStartRef.current = getEventPosition(event);
    onPreview();
  }, [clearCancelPreviewTimeout, enabled, onPreview]);

  const cancelPreviewForGesture = useCallback(() => {
    if (!enabled || !previewedRef.current) {
      return;
    }

    cancelledByMovementRef.current = true;
    previewedRef.current = false;
    clearCancelPreviewTimeout();
    onCancel();
  }, [clearCancelPreviewTimeout, enabled, onCancel]);

  const handleTouchMove = useCallback((event: GestureResponderEvent) => {
    if (!enabled || !previewedRef.current) {
      return;
    }

    const touchStart = touchStartRef.current;
    const currentPosition = getEventPosition(event);

    if (!touchStart || !currentPosition) {
      return;
    }

    const distanceX = currentPosition.pageX - touchStart.pageX;
    const distanceY = currentPosition.pageY - touchStart.pageY;
    if (
      distanceX * distanceX + distanceY * distanceY >
      TAP_INTENT_CANCEL_DISTANCE * TAP_INTENT_CANCEL_DISTANCE
    ) {
      cancelPreviewForGesture();
    }
  }, [cancelPreviewForGesture, enabled]);

  const handlePressOut = useCallback(() => {
    if (!enabled || !previewedRef.current) {
      return;
    }

    clearCancelPreviewTimeout();
    cancelPreviewTimeoutRef.current = setTimeout(() => {
      if (!committedRef.current && previewedRef.current) {
        previewedRef.current = false;
        onCancel();
      }

      cancelPreviewTimeoutRef.current = null;
    }, 0);
  }, [clearCancelPreviewTimeout, enabled, onCancel]);

  const handlePress = useCallback(() => {
    if (!enabled) {
      onCommit();
      return;
    }

    if (cancelledByMovementRef.current) {
      cancelledByMovementRef.current = false;
      clearCancelPreviewTimeout();
      return;
    }

    committedRef.current = true;
    previewedRef.current = false;
    clearCancelPreviewTimeout();
    onCommit();
  }, [clearCancelPreviewTimeout, enabled, onCommit]);

  return {
    onPress: handlePress,
    onPressIn: enabled ? handlePressIn : undefined,
    onPressOut: enabled ? handlePressOut : undefined,
    onTouchCancel: enabled ? cancelPreviewForGesture : undefined,
    onTouchMove: enabled ? handleTouchMove : undefined,
    pressRetentionOffset: enabled ? INTENT_SAFE_PRESS_RETENTION_OFFSET : undefined,
  };
}

function getEventPosition(event?: GestureResponderEvent): { pageX: number; pageY: number } | null {
  if (!event?.nativeEvent) {
    return null;
  }

  const { pageX, pageY } = event.nativeEvent;
  return typeof pageX === 'number' && typeof pageY === 'number' ? { pageX, pageY } : null;
}

function areAccountSelectionsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((accountId, index) => accountId === right[index]);
}

function getAccountSelectionMap(accountIds: string[]): AccountSelectionMap {
  return accountIds.reduce<AccountSelectionMap>((selectionMap, accountId) => {
    selectionMap[accountId] = true;
    return selectionMap;
  }, {});
}
