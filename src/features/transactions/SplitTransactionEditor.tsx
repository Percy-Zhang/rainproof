import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, FormError } from '../../components/ui';
import {
  getCategory,
  getSubcategoryColor,
  getSubcategoryIcon,
  getSubcategoryName,
} from '../../domain/categories';
import {
  formatMinorInput,
  getSplitTransactionFormSummary,
  getSplitTransactionValidationMessage,
  type SplitTransactionFormLine,
} from '../../domain/splitTransactionForm';
import { getFilteredTransactionItemNameSuggestions } from '../../domain/transactionItemSuggestions';
import { formatMoney } from '../../domain/money';
import type { CategoryDefinition, CurrencyCode } from '../../domain/types';
import { colors, spacing, typography } from '../../theme/tokens';
import { AutocompleteField, InlineField, SelectorRow } from './TransactionFormComponents';

type SplitTransactionEditorProps = {
  categories: CategoryDefinition[];
  currencyCode: CurrencyCode;
  itemNameSuggestions?: string[];
  lines: SplitTransactionFormLine[];
  showCurrencyCodes: boolean;
  totalMinor: number;
  onAddLine: () => void;
  onPickCategory: (lineId: string) => void;
  onRemoveLine: (lineId: string) => void;
  onUpdateLine: (lineId: string, patch: Partial<SplitTransactionFormLine>) => void;
};

type SplitTransactionEditorScrollContainerProps = {
  children: ReactNode;
  testID?: string;
};

type SplitEditorScrollContextValue = {
  revealNode: (node: View | null) => void;
};

const SplitEditorScrollContext = createContext<SplitEditorScrollContextValue | null>(null);

type KeyboardViewport = {
  height: number;
  topY: number | null;
};

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

export function SplitTransactionEditor({
  categories,
  currencyCode,
  itemNameSuggestions = [],
  lines,
  showCurrencyCodes,
  totalMinor,
  onAddLine,
  onPickCategory,
  onRemoveLine,
  onUpdateLine,
}: SplitTransactionEditorProps) {
  const summary = getSplitTransactionFormSummary(totalMinor, lines);
  const validationMessage = getSplitTransactionValidationMessage(totalMinor, lines);

  return (
    <View style={styles.stack}>
      <View style={styles.summaryGrid}>
        <SummaryCell label="Total" value={formatMoney(totalMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })} />
        <SummaryCell
          label="Allocated"
          value={formatMoney(summary.allocatedMinor, currencyCode, { showCurrencyCode: showCurrencyCodes })}
        />
        <SummaryCell
          label={summary.remainingMinor === 0 ? 'Remaining' : summary.remainingMinor > 0 ? 'Left' : 'Over'}
          value={formatMoney(Math.abs(summary.remainingMinor), currencyCode, { showCurrencyCode: showCurrencyCodes })}
          tone={summary.remainingMinor === 0 ? 'balanced' : 'warning'}
        />
      </View>

      <FormError message={validationMessage && lines.length >= 2 ? validationMessage : ''} />

      {lines.map((line, index) => {
        const category = getCategory(line.categoryId, categories);

        return (
          <Card key={line.id} style={styles.lineCard} testID={`split-line-${index + 1}`}>
            <View style={styles.lineHeader}>
              <Text style={styles.lineTitle}>Split line {index + 1}</Text>
              <Pressable
                accessibilityLabel={`Remove split line ${index + 1}`}
                accessibilityRole="button"
                onPress={() => onRemoveLine(line.id)}
                style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
            <RevealableSplitField>
              {({ onBlur, onFocus }) => (
                <InlineField
                  label="Amount"
                  value={line.amount}
                  onChange={(amount) => onUpdateLine(line.id, { amount })}
                  onBlur={onBlur}
                  onFocus={onFocus}
                  placeholder={formatMinorInput(0)}
                  keyboardType="decimal-pad"
                  rightLabel={showCurrencyCodes ? currencyCode : undefined}
                  selectAllOnFocus
                />
              )}
            </RevealableSplitField>
            <SelectorRow
              label="Category"
              value={`${category.name} / ${getSubcategoryName(category.id, line.subcategoryId, categories)}`}
              onPress={() => onPickCategory(line.id)}
              color={getSubcategoryColor(category.id, line.subcategoryId, categories)}
              icon={getSubcategoryIcon(category.id, line.subcategoryId, categories)}
              iconColor={getSubcategoryColor(category.id, line.subcategoryId, categories)}
              empty={!line.subcategoryId}
            />
            <RevealableSplitField>
              {({ onBlur, onFocus }) => (
                <AutocompleteField
                  label="Line item"
                  value={line.note}
                  onChange={(note) => onUpdateLine(line.id, { note })}
                  onBlur={onBlur}
                  onFocus={onFocus}
                  placeholder="Optional"
                  suggestions={getFilteredTransactionItemNameSuggestions(itemNameSuggestions, line.note)}
                />
              )}
            </RevealableSplitField>
          </Card>
        );
      })}

      <Pressable
        accessibilityRole="button"
        onPress={onAddLine}
        style={({ pressed }) => [styles.addLineButton, pressed && styles.pressed]}
        testID="add-split-line"
      >
        <Ionicons name="add" size={18} color={colors.primaryDark} />
        <Text style={styles.addLineText}>Add split line</Text>
      </Pressable>
    </View>
  );
}

function RevealableSplitField({
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

function SummaryCell({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'balanced' | 'warning';
}) {
  return (
    <View style={[styles.summaryCell, tone === 'balanced' && styles.summaryBalanced, tone === 'warning' && styles.summaryWarning]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardPane: {
    flex: 1,
  },
  keyboardScrollWrapper: {
    flex: 1,
  },
  keyboardScroll: {
    flex: 1,
  },
  keyboardScrollContent: {
    flexGrow: 1,
    gap: spacing.sm,
  },
  stack: {
    gap: spacing.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryCell: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 96,
    padding: spacing.sm,
  },
  summaryBalanced: {
    backgroundColor: '#E4F3EF',
    borderColor: colors.success,
  },
  summaryWarning: {
    backgroundColor: '#F8E8E8',
    borderColor: colors.danger,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  lineCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  lineHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  lineTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '900',
  },
  removeButton: {
    alignItems: 'center',
    borderColor: '#E4C3C3',
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  addLineButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  addLineText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.78,
  },
});
