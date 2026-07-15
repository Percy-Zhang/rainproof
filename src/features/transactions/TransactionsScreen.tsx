import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Keyboard, Platform, Pressable, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CompactAccountSelector,
  type CompactAccountSelectorMode,
} from '../../components/CompactAccountSelector';
import { TransactionQuickActions } from '../../components/TransactionQuickActions';
import { Card, SectionHeader } from '../../components/ui';
import type { AccountBalance, AppSnapshot } from '../../domain/types';
import { colors } from '../../theme/tokens';
import { TransactionsBottomControls } from './TransactionsBottomControls';
import { TransactionsListCard } from './TransactionsListCard';
import { shouldKeepTransactionsSearchVisible } from './transactionsSearchFocus';
import {
  transactionSearchPlaceholderColor,
  transactionsScreenStyles as styles,
} from './TransactionsScreenStyles';
import {
  createDefaultTransactionPeriodState,
  useTransactionsViewModel,
  type TransactionPeriodState,
} from './useTransactionsViewModel';

type TransactionsScreenProps = {
  accountBalances: AccountBalance[];
  snapshot: AppSnapshot;
  defaultSelectedAccountIds?: string[];
  periodState: TransactionPeriodState;
  onPeriodStateChange: (periodState: TransactionPeriodState) => void;
  onAddTransaction: (params?: { dashboardAccountIds?: string[] }) => void;
  onOpenTemplates: () => void;
  onOpenTransaction: (transactionId: string) => void;
  showHeader?: boolean;
};

export { createDefaultTransactionPeriodState };
export type { TransactionPeriodState };

const TRANSACTIONS_HEADER_DELTA_IGNORE_THRESHOLD = 8;
const TRANSACTIONS_HEADER_SCROLL_THRESHOLD = 48;
const TRANSACTIONS_HEADER_TRANSITION_GUARD_MS = 320;
const TRANSACTIONS_HEADER_MANUAL_GUARD_MS = 420;
const TRANSACTIONS_HEADER_TOP_RESTORE_OFFSET = 6;
const TRANSACTIONS_SEARCH_REVEAL_DURATION_MS = 190;
const TRANSACTIONS_SEARCH_REVEAL_HEIGHT = 62;
const TRANSACTIONS_FLOATING_ADD_BUTTON_SIZE = 58;

export function TransactionsScreen({
  accountBalances,
  snapshot,
  defaultSelectedAccountIds,
  periodState,
  onPeriodStateChange,
  onAddTransaction,
  onOpenTemplates,
  onOpenTransaction,
  showHeader = true,
}: TransactionsScreenProps) {
  const insets = useSafeAreaInsets();
  const [accountSelectorMode, setAccountSelectorMode] = useState<CompactAccountSelectorMode>('peek');
  const [searchVisible, setSearchVisible] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const keyboardVisible = useKeyboardVisible();
  const accountSelectorModeRef = useRef<CompactAccountSelectorMode>('peek');
  const searchVisibleRef = useRef(true);
  const headerTransitionUntilRef = useRef(0);
  const manualHeaderLockUntilRef = useRef(0);
  const scrollDecisionLockedRef = useRef(false);
  const scrollUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollOffsetYRef = useRef(0);
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const scrollDeltaRef = useRef(0);
  const searchInputRef = useRef<TextInput>(null);
  const pendingSearchFocusRef = useRef(false);
  const listReady = useDeferredTransactionListReady();
  const viewModel = useTransactionsViewModel({
    bottomInset: insets.bottom,
    deferListDerivation: !listReady,
    defaultSelectedAccountIds,
    onPeriodStateChange,
    periodState,
    snapshot,
  });
  const searchQuery = viewModel.searchQuery;
  const setSearchQuery = viewModel.setSearchQuery;
  const contextAccountId =
    viewModel.listSelectedAccountIds.length === 1 ? viewModel.listSelectedAccountIds[0] : undefined;
  const searchMustRemainVisible = shouldKeepTransactionsSearchVisible({
    keyboardVisible,
    searchQuery,
    searchFocused,
  });
  const visibleSearch = accountSelectorMode !== 'summary' || searchVisible || searchMustRemainVisible;

  const setAccountSelectorModeSynced = useCallback((nextMode: CompactAccountSelectorMode) => {
    accountSelectorModeRef.current = nextMode;
    setAccountSelectorMode(nextMode);
  }, []);

  const setSearchVisibleSynced = useCallback((nextVisible: boolean) => {
    searchVisibleRef.current = nextVisible;
    setSearchVisible(nextVisible);
  }, []);

  const resetScrollIntentTracking = useCallback((offsetY?: number) => {
    if (offsetY !== undefined) {
      lastScrollOffsetYRef.current = offsetY;
    }
    scrollDirectionRef.current = null;
    scrollDeltaRef.current = 0;
  }, []);

  const clearScheduledScrollUnlock = useCallback(() => {
    if (scrollUnlockTimeoutRef.current) {
      clearTimeout(scrollUnlockTimeoutRef.current);
      scrollUnlockTimeoutRef.current = null;
    }
  }, []);

  const getRemainingHeaderGuardMs = useCallback(() => Math.max(
    0,
    Math.max(headerTransitionUntilRef.current, manualHeaderLockUntilRef.current) - Date.now(),
  ), []);

  const unlockScrollDrivenHeaderDecisionsNow = useCallback((offsetY: number) => {
    scrollDecisionLockedRef.current = false;
    resetScrollIntentTracking(offsetY);
  }, [resetScrollIntentTracking]);

  const scheduleScrollDrivenHeaderUnlock = useCallback((offsetY: number) => {
    clearScheduledScrollUnlock();
    const remainingTransitionMs = getRemainingHeaderGuardMs();

    if (!remainingTransitionMs) {
      unlockScrollDrivenHeaderDecisionsNow(offsetY);
      return;
    }

    scrollUnlockTimeoutRef.current = setTimeout(() => {
      scrollUnlockTimeoutRef.current = null;
      unlockScrollDrivenHeaderDecisionsNow(offsetY);
    }, remainingTransitionMs);
  }, [
    clearScheduledScrollUnlock,
    getRemainingHeaderGuardMs,
    unlockScrollDrivenHeaderDecisionsNow,
  ]);

  const unlockScrollDrivenHeaderDecisions = useCallback((offsetY: number) => {
    scheduleScrollDrivenHeaderUnlock(offsetY);
  }, [scheduleScrollDrivenHeaderUnlock]);

  useEffect(() => clearScheduledScrollUnlock, [clearScheduledScrollUnlock]);

  const setScrollDrivenHeaderState = useCallback(({
    accountMode,
    nextSearchVisible,
  }: {
    accountMode: CompactAccountSelectorMode;
    nextSearchVisible?: boolean;
  }) => {
    const currentMode = accountSelectorModeRef.current;
    const resolvedMode = currentMode === 'expanded' && accountMode === 'peek' ? currentMode : accountMode;
    const shouldUpdateMode = currentMode !== resolvedMode;
    const resolvedSearchVisible =
      nextSearchVisible === undefined || searchMustRemainVisible ? searchVisibleRef.current : nextSearchVisible;
    const shouldUpdateSearch = searchVisibleRef.current !== resolvedSearchVisible;

    if (!shouldUpdateMode && !shouldUpdateSearch) {
      return;
    }

    scrollDecisionLockedRef.current = true;
    headerTransitionUntilRef.current = Date.now() + TRANSACTIONS_HEADER_TRANSITION_GUARD_MS;
    if (shouldUpdateMode) {
      setAccountSelectorModeSynced(resolvedMode);
    }
    if (shouldUpdateSearch) {
      setSearchVisibleSynced(resolvedSearchVisible);
    }
  }, [searchMustRemainVisible, setAccountSelectorModeSynced, setSearchVisibleSynced]);

  const setManualAccountSelectorMode = useCallback((nextMode: CompactAccountSelectorMode) => {
    clearScheduledScrollUnlock();
    manualHeaderLockUntilRef.current = Date.now() + TRANSACTIONS_HEADER_MANUAL_GUARD_MS;
    headerTransitionUntilRef.current = Date.now() + TRANSACTIONS_HEADER_TRANSITION_GUARD_MS;
    scrollDecisionLockedRef.current = true;
    resetScrollIntentTracking();
    setAccountSelectorModeSynced(nextMode);
  }, [clearScheduledScrollUnlock, resetScrollIntentTracking, setAccountSelectorModeSynced]);

  useEffect(() => {
    if (searchMustRemainVisible) {
      setSearchVisibleSynced(true);
    }
  }, [searchMustRemainVisible, setSearchVisibleSynced]);

  const focusSearchInput = useCallback(() => {
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!visibleSearch || !pendingSearchFocusRef.current) {
      return;
    }

    pendingSearchFocusRef.current = false;
    focusSearchInput();
  }, [focusSearchInput, visibleSearch]);

  const handleSearchFocus = useCallback(() => {
    setSearchFocused(true);
    setSearchVisibleSynced(true);
  }, [setSearchVisibleSynced]);

  const handleSearchBlur = useCallback(() => {
    setSearchFocused(false);
  }, []);

  const handleAccountExpandToggle = useCallback(() => {
    const currentMode = accountSelectorModeRef.current;
    const nextMode =
      currentMode === 'summary'
        ? 'peek'
        : currentMode === 'peek'
          ? 'expanded'
          : 'peek';
    setManualAccountSelectorMode(nextMode);

    if (keyboardVisible || searchFocused) {
      Keyboard.dismiss();
      setSearchFocused(false);
    }

    if (!searchQuery.trim()) {
      setSearchVisibleSynced(false);
    }
  }, [
    keyboardVisible,
    searchQuery,
    searchFocused,
    setManualAccountSelectorMode,
    setSearchVisibleSynced,
  ]);

  const handlePressCompactSearch = useCallback(() => {
    const hasActiveSearchQuery = searchQuery.trim().length > 0;
    if (visibleSearch && !hasActiveSearchQuery) {
      pendingSearchFocusRef.current = false;
      setManualAccountSelectorMode('summary');
      searchInputRef.current?.blur();
      if (keyboardVisible || searchFocused) {
        Keyboard.dismiss();
        setSearchFocused(false);
      }
      setSearchVisibleSynced(false);
      return;
    }

    pendingSearchFocusRef.current = true;
    setSearchVisibleSynced(true);
    setManualAccountSelectorMode('summary');
    if (visibleSearch) {
      pendingSearchFocusRef.current = false;
      focusSearchInput();
    }
  }, [
    focusSearchInput,
    keyboardVisible,
    searchFocused,
    searchQuery,
    setManualAccountSelectorMode,
    setSearchVisibleSynced,
    visibleSearch,
  ]);

  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      setSearchVisibleSynced(true);
    }
  }, [setSearchQuery, setSearchVisibleSynced]);

  const handleTransactionListScrollBeginDrag = useCallback((offsetY: number) => {
    clearScheduledScrollUnlock();
    manualHeaderLockUntilRef.current = 0;
    scrollDecisionLockedRef.current = false;
    headerTransitionUntilRef.current = 0;
    resetScrollIntentTracking(offsetY);
  }, [clearScheduledScrollUnlock, resetScrollIntentTracking]);

  const handleTransactionListScrollEndDrag = useCallback((offsetY: number) => {
    scheduleScrollDrivenHeaderUnlock(offsetY);
  }, [scheduleScrollDrivenHeaderUnlock]);

  const handleTransactionListMomentumBegin = useCallback((offsetY: number) => {
    clearScheduledScrollUnlock();
    resetScrollIntentTracking(offsetY);
  }, [clearScheduledScrollUnlock, resetScrollIntentTracking]);

  const handleTransactionListMomentumEnd = useCallback((offsetY: number) => {
    unlockScrollDrivenHeaderDecisions(offsetY);
  }, [unlockScrollDrivenHeaderDecisions]);

  const handleTransactionListScroll = useCallback((offsetY: number) => {
    const previousOffsetY = lastScrollOffsetYRef.current;
    const deltaY = offsetY - previousOffsetY;
    lastScrollOffsetYRef.current = offsetY;

    if (Math.abs(deltaY) < TRANSACTIONS_HEADER_DELTA_IGNORE_THRESHOLD) {
      return;
    }

    if (offsetY <= TRANSACTIONS_HEADER_TOP_RESTORE_OFFSET) {
      clearScheduledScrollUnlock();
      scrollDecisionLockedRef.current = false;
      headerTransitionUntilRef.current = 0;
      resetScrollIntentTracking(offsetY);
      return;
    }

    if (scrollDecisionLockedRef.current || getRemainingHeaderGuardMs() > 0) {
      return;
    }

    const nextDirection = deltaY > 0 ? 'down' : 'up';
    if (scrollDirectionRef.current !== nextDirection) {
      scrollDirectionRef.current = nextDirection;
      scrollDeltaRef.current = 0;
    }

    scrollDeltaRef.current += deltaY;
    if (nextDirection === 'down' && scrollDeltaRef.current >= TRANSACTIONS_HEADER_SCROLL_THRESHOLD) {
      scrollDeltaRef.current = 0;
      setScrollDrivenHeaderState({
        accountMode: 'summary',
        nextSearchVisible: false,
      });
      return;
    }

    if (nextDirection === 'up' && scrollDeltaRef.current <= -TRANSACTIONS_HEADER_SCROLL_THRESHOLD) {
      scrollDeltaRef.current = 0;
    }
  }, [
    clearScheduledScrollUnlock,
    getRemainingHeaderGuardMs,
    resetScrollIntentTracking,
    setScrollDrivenHeaderState,
  ]);

  return (
    <View style={styles.screen}>
      <View style={styles.fixedFilter}>
        {showHeader ? (
          <SectionHeader title="Transactions" detail="Review transactions by period and account." />
        ) : null}

        <CompactAccountSelector
          accounts={viewModel.selectableAccounts}
          accountBalances={accountBalances}
          immediateSelectionFeedback
          selectedAccountIds={viewModel.selectedAccountIds}
          title="Accounts"
          mode={accountSelectorMode}
          onClearSelection={viewModel.clearSelectedAccounts}
          onPressExpandToggle={handleAccountExpandToggle}
          onPressSummarySearch={handlePressCompactSearch}
          onSelectAll={viewModel.selectAllAccounts}
          onSelectedAccountIdsChange={viewModel.setSelectedAccounts}
          onToggleAccount={viewModel.toggleAccount}
          testID="transactions-account-selector"
        />

        <AnimatedSearchReveal visible={visibleSearch}>
          <TransactionSearchCard
            inputRef={searchInputRef}
            onBlur={handleSearchBlur}
            onFocus={handleSearchFocus}
            onSearchQueryChange={handleSearchQueryChange}
            searchQuery={searchQuery}
          />
        </AnimatedSearchReveal>
      </View>

      <View style={styles.listArea}>
        <TransactionsListCard
          accounts={snapshot.accounts}
          balanceAfterByEntryId={viewModel.balanceAfterByEntryId}
          bottomPadding={viewModel.bottomPadding}
          categories={viewModel.categories}
          contextAccountId={contextAccountId}
          emptyMessage={viewModel.emptyMessage}
          groups={viewModel.groups}
          isLoading={viewModel.isListDeferred}
          suppressRowAnimations={viewModel.suppressRowAnimationsForAccountFilter}
          onMomentumScrollBegin={handleTransactionListMomentumBegin}
          onMomentumScrollEnd={handleTransactionListMomentumEnd}
          onOpenTransaction={onOpenTransaction}
          onScrollBeginDrag={handleTransactionListScrollBeginDrag}
          onScrollEndDrag={handleTransactionListScrollEndDrag}
          onScrollOffsetChange={handleTransactionListScroll}
          showCurrencyCodes={viewModel.showCurrencyCodes}
        />
      </View>

      <TransactionsBottomControls
        datePickerTarget={viewModel.datePickerTarget}
        onCloseDatePicker={() => viewModel.setDatePickerTarget(null)}
        onDatePickerChange={viewModel.handleDatePickerChange}
        onOpenDatePicker={viewModel.setDatePickerTarget}
        onSelectPeriodOption={viewModel.selectPeriodOption}
        periodState={periodState}
        selectedPeriodOption={viewModel.selectedPeriodOption}
      />

      <TransactionQuickActions
        bottom={viewModel.bottomPadding - insets.bottom - TRANSACTIONS_FLOATING_ADD_BUTTON_SIZE}
        context="transactions"
        onAddTransaction={onAddTransaction}
        onOpenTemplates={onOpenTemplates}
        selectedAccountIds={viewModel.selectedAccountIds}
      />
    </View>
  );
}

function useDeferredTransactionListReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const idleCallbackId = requestIdleCallback(() => {
      if (!cancelled) {
        setReady(true);
      }
    });

    return () => {
      cancelled = true;
      cancelIdleCallback(idleCallbackId);
    };
  }, []);

  return ready;
}

function AnimatedSearchReveal({
  children,
  visible,
}: {
  children: ReactNode;
  visible: boolean;
}) {
  const [shouldRender, setShouldRender] = useState(visible);
  const revealHeight = useSharedValue(visible ? TRANSACTIONS_SEARCH_REVEAL_HEIGHT : 0);
  const revealOpacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (visible) {
      setShouldRender(true);
      revealHeight.value = withTiming(TRANSACTIONS_SEARCH_REVEAL_HEIGHT, {
        duration: TRANSACTIONS_SEARCH_REVEAL_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      });
      revealOpacity.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      revealOpacity.value = withTiming(0, {
        duration: 130,
        easing: Easing.out(Easing.cubic),
      });
      revealHeight.value = withTiming(0, {
        duration: TRANSACTIONS_SEARCH_REVEAL_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      });
      timeoutId = setTimeout(() => {
        setShouldRender(false);
      }, TRANSACTIONS_SEARCH_REVEAL_DURATION_MS);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [revealHeight, revealOpacity, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: revealHeight.value,
    opacity: revealOpacity.value,
    transform: [{ translateY: (1 - revealOpacity.value) * -4 }],
  }));

  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.searchReveal, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

function useKeyboardVisible(): boolean {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  return keyboardVisible;
}

function TransactionSearchCard({
  inputRef,
  onBlur,
  onFocus,
  onSearchQueryChange,
  searchQuery,
}: {
  inputRef: RefObject<TextInput | null>;
  onBlur: () => void;
  onFocus: () => void;
  onSearchQueryChange: (query: string) => void;
  searchQuery: string;
}) {
  const handleClearSearch = useCallback(() => {
    onSearchQueryChange('');
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [inputRef, onSearchQueryChange]);

  return (
    <Card style={styles.searchCard}>
      <View style={styles.searchInputContainer}>
        <TextInput
          ref={inputRef}
          accessibilityLabel="Search transactions"
          autoCapitalize="none"
          autoCorrect={false}
          onBlur={onBlur}
          onChangeText={onSearchQueryChange}
          onFocus={onFocus}
          placeholder="Search transactions"
          placeholderTextColor={transactionSearchPlaceholderColor}
          returnKeyType="search"
          style={styles.searchInput}
          value={searchQuery}
        />
        {searchQuery.length ? (
          <Pressable
            accessibilityLabel="Clear transaction search"
            accessibilityRole="button"
            hitSlop={4}
            onPress={handleClearSearch}
            style={({ pressed }) => [styles.searchClearButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}
