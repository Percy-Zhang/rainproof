import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../../theme/tokens';

type SplitTransactionEditorScrollContainerProps = {
  children: ReactNode;
  testID?: string;
};

type SplitEditorScrollContextValue = {
  revealNode: (node: View | null) => void;
};

type KeyboardViewport = {
  height: number;
  topY: number | null;
};

const SplitEditorScrollContext = createContext<SplitEditorScrollContextValue | null>(null);

export function SplitTransactionEditorScrollContainer({
  children,
  testID,
}: SplitTransactionEditorScrollContainerProps) {
  const insets = useSafeAreaInsets();
  const scrollViewportRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const pendingFocusedNodeRef = useRef<View | null>(null);
  const keyboardViewport = useKeyboardViewport();
  const [scrollViewportBottom, setScrollViewportBottom] = useState<number | null>(null);
  const keyboardScrollPadding = getKeyboardScrollPadding(keyboardViewport, scrollViewportBottom);

  const revealNodeNow = useCallback((node: View | null) => {
    if (!node || !scrollViewportRef.current) {
      return;
    }

    scrollViewportRef.current.measureInWindow((_: number, scrollWindowY: number, __: number, scrollHeight: number) => {
      node.measureInWindow((___: number, fieldWindowY: number, ____: number, fieldHeight: number) => {
        const topGuard = spacing.md;
        const bottomGuard = spacing.xxl + spacing.md;
        const viewportBottom = scrollWindowY + scrollHeight;
        const keyboardTop = getKeyboardTopY(keyboardViewport);
        const visibleTop = scrollWindowY + topGuard;
        const visibleBottom = Math.min(viewportBottom, keyboardTop ?? viewportBottom) - bottomGuard;
        const fieldTop = fieldWindowY;
        const fieldBottom = fieldWindowY + fieldHeight;

        if (fieldBottom > visibleBottom) {
          scrollRef.current?.scrollTo({
            animated: true,
            y: Math.max(0, scrollYRef.current + fieldBottom - visibleBottom),
          });
          return;
        }

        if (fieldTop < visibleTop) {
          scrollRef.current?.scrollTo({
            animated: true,
            y: Math.max(0, scrollYRef.current - (visibleTop - fieldTop)),
          });
        }
      });
    });
  }, [keyboardViewport]);

  const revealNode = useCallback((node: View | null) => {
    pendingFocusedNodeRef.current = node;
    requestAnimationFrame(() => revealNodeNow(node));
    setTimeout(() => revealNodeNow(node), Platform.OS === 'android' ? 140 : 90);
  }, [revealNodeNow]);

  const contextValue = useMemo<SplitEditorScrollContextValue>(() => ({
    revealNode,
  }), [revealNode]);

  useEffect(() => {
    if (keyboardViewport.height <= 0 || !pendingFocusedNodeRef.current) {
      return undefined;
    }

    const timer = setTimeout(() => {
      if (pendingFocusedNodeRef.current) {
        revealNodeNow(pendingFocusedNodeRef.current);
      }
    }, Platform.OS === 'android' ? 80 : 50);

    return () => clearTimeout(timer);
  }, [keyboardViewport.height, revealNodeNow]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
  }

  function handleLayout() {
    scrollViewportRef.current?.measureInWindow((_: number, scrollWindowY: number, __: number, scrollHeight: number) => {
      const nextScrollViewportBottom = scrollWindowY + scrollHeight;
      setScrollViewportBottom((current) => (
        current === nextScrollViewportBottom ? current : nextScrollViewportBottom
      ));
    });

    if (pendingFocusedNodeRef.current) {
      requestAnimationFrame(() => {
        if (pendingFocusedNodeRef.current) {
          revealNodeNow(pendingFocusedNodeRef.current);
        }
      });
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={spacing.xl}
      style={styles.keyboardPane}
    >
      <SplitEditorScrollContext.Provider value={contextValue}>
        <View ref={scrollViewportRef} style={styles.keyboardScrollWrapper}>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={[
              styles.keyboardScrollContent,
              { paddingBottom: insets.bottom + spacing.xxl + keyboardScrollPadding },
            ]}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            onLayout={handleLayout}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={styles.keyboardScroll}
            testID={testID}
          >
            {children}
          </ScrollView>
        </View>
      </SplitEditorScrollContext.Provider>
    </KeyboardAvoidingView>
  );
}

export function RevealableSplitField({
  children,
}: {
  children: (handlers: { onBlur: () => void; onFocus: () => void }) => ReactNode;
}) {
  const scrollContext = useContext(SplitEditorScrollContext);
  const fieldRef = useRef<View>(null);
  const isFocusedRef = useRef(false);
  const onLayout = useCallback(() => {
    if (isFocusedRef.current) {
      scrollContext?.revealNode(fieldRef.current);
    }
  }, [scrollContext]);
  const onBlur = useCallback(() => {
    isFocusedRef.current = false;
  }, []);
  const onFocus = useCallback(() => {
    isFocusedRef.current = true;
    scrollContext?.revealNode(fieldRef.current);
  }, [scrollContext]);

  return (
    <View ref={fieldRef} onLayout={onLayout}>
      {children({ onBlur, onFocus })}
    </View>
  );
}

function useKeyboardViewport(): KeyboardViewport {
  const [keyboardViewport, setKeyboardViewport] = useState<KeyboardViewport>({ height: 0, topY: null });

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardViewport({
        height: event.endCoordinates.height,
        topY: event.endCoordinates.screenY > 0 ? event.endCoordinates.screenY : null,
      });
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardViewport({ height: 0, topY: null });
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardViewport;
}

function getKeyboardTopY(keyboardViewport: KeyboardViewport): number | null {
  if (keyboardViewport.height <= 0) {
    return null;
  }

  if (keyboardViewport.topY !== null) {
    return keyboardViewport.topY;
  }

  return Dimensions.get('window').height - keyboardViewport.height;
}

function getKeyboardScrollPadding(
  keyboardViewport: KeyboardViewport,
  scrollViewportBottom: number | null,
): number {
  if (Platform.OS !== 'android') {
    return 0;
  }

  const keyboardTop = getKeyboardTopY(keyboardViewport);
  if (keyboardTop === null) {
    return 0;
  }

  const viewportBottom = scrollViewportBottom ?? Dimensions.get('window').height;
  return Math.max(0, viewportBottom - keyboardTop);
}

const styles = StyleSheet.create({
  keyboardPane: {
    flex: 1,
  },
  keyboardScroll: {
    flex: 1,
  },
  keyboardScrollContent: {
    flexGrow: 1,
    gap: spacing.sm,
  },
  keyboardScrollWrapper: {
    flex: 1,
  },
});
