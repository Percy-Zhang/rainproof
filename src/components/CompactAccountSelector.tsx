import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { getAccountDisplayName, getTransparentColor } from '../domain/accountThemes';
import {
  getAccountSelectionBalanceLabel,
  getCompactAccountSelectionSummary,
  getAccountSelectionSummary,
} from '../domain/accountSelection';
import type { Account, AccountBalance } from '../domain/types';
import {
  getResponsiveAccountColumnsForItemCount,
  getResponsiveAccountTileBasisForColumns,
  RESPONSIVE_ACCOUNT_TILE_MIN_WIDTH,
} from '../theme/responsiveLayout';
import { colors, spacing, typography } from '../theme/tokens';
import { Card } from './ui';
import {
  type AccountSelectionMap,
  useImmediateAccountSelection,
  useTapIntentPressHandlers,
} from './useImmediateAccountSelection';

type CompactAccountSelectorProps = {
  accounts: Account[];
  accountBalances?: AccountBalance[];
  selectedAccountIds: string[];
  title: string;
  emptyMessage?: string;
  immediateSelectionFeedback?: boolean;
  onClearSelection: () => void;
  onPressExpandToggle?: () => void;
  onPressSummarySearch?: () => void;
  onSelectAll: () => void;
  onSelectedAccountIdsChange?: (accountIds: string[]) => void;
  onToggleAccount: (accountId: string) => void;
  mode?: CompactAccountSelectorMode;
  testID?: string;
};

const ACCOUNT_TILE_MIN_HEIGHT = 62;
const ACCOUNT_GRID_BOTTOM_PADDING = spacing.sm + 4;
const NEXT_ROW_PEEK_HEIGHT = 6;
const SCROLLABLE_ACCOUNT_LIST_HEIGHT =
  ACCOUNT_TILE_MIN_HEIGHT + spacing.sm + NEXT_ROW_PEEK_HEIGHT;
const ACCOUNT_SELECTOR_REVEAL_DURATION_MS = 145;
const ACCOUNT_SELECTOR_REVEAL_OPACITY_IN_DURATION_MS = 110;
const ACCOUNT_SELECTOR_REVEAL_OPACITY_OUT_DURATION_MS = 90;
const ACCOUNT_SELECTOR_EXPANDED_MAX_HEIGHT_RATIO = 0.5;
const noopSelectedAccountIdsChange = () => undefined;
const noopPressHandler = () => undefined;
type AccountTileBasis = ReturnType<typeof getResponsiveAccountTileBasisForColumns>;
export type CompactAccountSelectorMode = 'peek' | 'summary' | 'expanded';

export function CompactAccountSelector({
  accounts,
  accountBalances = [],
  selectedAccountIds,
  title,
  emptyMessage = 'No accounts available.',
  immediateSelectionFeedback = false,
  onClearSelection,
  onPressExpandToggle,
  onPressSummarySearch,
  onSelectAll,
  onSelectedAccountIdsChange,
  onToggleAccount,
  mode = 'peek',
  testID,
}: CompactAccountSelectorProps) {
  const { height, width } = useWindowDimensions();
  const accountColumns = getResponsiveAccountColumnsForItemCount(width, accounts.length);
  const tileBasis = getResponsiveAccountTileBasisForColumns(accountColumns);
  const accountIds = accounts.map((account) => account.id);
  const immediateSelectionEnabled = immediateSelectionFeedback && Boolean(onSelectedAccountIdsChange);
  const immediateSelection = useImmediateAccountSelection({
    enabled: immediateSelectionEnabled,
    onApplySelectedAccountIds: onSelectedAccountIdsChange ?? noopSelectedAccountIdsChange,
    selectedAccountIds,
  });
  const visualSelectedAccountIds = immediateSelectionEnabled ? immediateSelection.selectedAccountIds : selectedAccountIds;
  const selectedAccountIdSet = new Set(visualSelectedAccountIds);
  const allSelected = accounts.length > 0 && accounts.every((account) => selectedAccountIdSet.has(account.id));
  const summary = getAccountSelectionSummary(accounts, visualSelectedAccountIds);
  const compactSummary = getCompactAccountSelectionSummary(accounts, visualSelectedAccountIds);
  const summaryDetail = mode === 'summary' ? compactSummary : summary.detail;
  const accountRowCount = Math.ceil(accounts.length / accountColumns);
  const fullAccountListHeight = getAccountListHeightForRows(accountRowCount);
  const maxExpandedAccountListHeight = Math.max(
    SCROLLABLE_ACCOUNT_LIST_HEIGHT,
    Math.floor(height * ACCOUNT_SELECTOR_EXPANDED_MAX_HEIGHT_RATIO),
  );
  const expandedAccountListHeight = Math.min(fullAccountListHeight, maxExpandedAccountListHeight);
  const listShouldScroll = accounts.length > accountColumns;
  const getAccountListTargetHeight = useCallback(
    (targetMode: CompactAccountSelectorMode) => getAccountListTargetHeightForMode({
      expandedAccountListHeight,
      fullAccountListHeight,
      listShouldScroll,
      mode: targetMode,
    }),
    [expandedAccountListHeight, fullAccountListHeight, listShouldScroll],
  );
  const accountListTargetHeight = getAccountListTargetHeight(mode);
  const accountListScrollEnabled =
    mode === 'expanded' ? fullAccountListHeight > expandedAccountListHeight : listShouldScroll;
  const balanceMinorByAccountId = new Map(
    accountBalances.map(({ account, balanceMinor }) => [account.id, balanceMinor]),
  );
  const expandButtonLabel = getExpandButtonLabel(mode);
  const expandButtonIcon = mode === 'expanded' ? 'chevron-up' : 'chevron-down';
  const revealHeight = useSharedValue(accountListTargetHeight);
  const revealOpacity = useSharedValue(mode !== 'summary' ? 1 : 0);
  const accountListScrollRef = useRef<ScrollView>(null);
  const localModeRef = useRef(mode);
  const immediateRevealTargetRef = useRef<{ height: number; mode: CompactAccountSelectorMode } | null>(null);

  const animateAccountListToMode = useCallback((
    targetMode: CompactAccountSelectorMode,
    source: 'manual' | 'sync' = 'sync',
  ) => {
    const targetHeight = getAccountListTargetHeight(targetMode);
    const targetExpanded = targetMode !== 'summary';

    if (source === 'manual') {
      immediateRevealTargetRef.current = { height: targetHeight, mode: targetMode };
    }

    cancelAnimation(revealHeight);
    cancelAnimation(revealOpacity);
    revealHeight.value = withTiming(targetHeight, {
      duration: ACCOUNT_SELECTOR_REVEAL_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    revealOpacity.value = withTiming(targetExpanded ? 1 : 0, {
      duration: targetExpanded
        ? ACCOUNT_SELECTOR_REVEAL_OPACITY_IN_DURATION_MS
        : ACCOUNT_SELECTOR_REVEAL_OPACITY_OUT_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [getAccountListTargetHeight, revealHeight, revealOpacity]);

  useEffect(() => {
    const immediateTarget = immediateRevealTargetRef.current;
    if (immediateTarget?.mode === mode && immediateTarget.height === accountListTargetHeight) {
      immediateRevealTargetRef.current = null;
      return;
    }

    animateAccountListToMode(mode);
  }, [accountListTargetHeight, animateAccountListToMode, mode]);

  useLayoutEffect(() => {
    localModeRef.current = mode;
  }, [mode]);

  const handlePressExpandToggle = useCallback(() => {
    if (!onPressExpandToggle) {
      return;
    }

    const nextMode = getNextAccountSelectorMode(localModeRef.current);
    localModeRef.current = nextMode;
    if (nextMode === 'expanded') {
      accountListScrollRef.current?.scrollTo({ animated: false, y: 0 });
    }
    animateAccountListToMode(nextMode, 'manual');
    onPressExpandToggle();
  }, [animateAccountListToMode, onPressExpandToggle]);
  const summaryExpandPressHandlers = useImmediatePressHandlers(handlePressExpandToggle, Boolean(onPressExpandToggle));
  const handleCancelSelectionPreview = useCallback(() => {
    immediateSelection.cancelSelectionPreview();
  }, [immediateSelection]);
  const handleClearSelection = useCallback(() => {
    onClearSelection();
  }, [onClearSelection]);
  const handleSelectAll = useCallback(() => {
    onSelectAll();
  }, [onSelectAll]);
  const handleToggleAccount = useCallback((accountId: string) => {
    if (immediateSelectionEnabled) {
      immediateSelection.toggleAccount(accountId);
      return;
    }

    onToggleAccount(accountId);
  }, [immediateSelection, immediateSelectionEnabled, onToggleAccount]);

  return (
    <Card testID={testID} style={mode === 'summary' ? styles.summaryCard : styles.card}>
      {mode === 'summary' ? (
        <View style={styles.summaryRow}>
          {onPressSummarySearch ? (
            <AccountSelectorIconButton
              accessibilityLabel="Search transactions"
              iconName="search-outline"
              onPress={onPressSummarySearch}
              shape="roundedSquare"
              size="summary"
            />
          ) : null}
          {onPressExpandToggle ? (
            <Pressable
              accessibilityLabel={expandButtonLabel}
              accessibilityRole="button"
              {...summaryExpandPressHandlers}
              style={({ pressed }) => [
                styles.summaryExpandArea,
                !onPressSummarySearch && styles.summaryExpandAreaWithoutSearch,
                pressed && styles.pressed,
              ]}
            >
              <Text numberOfLines={1} style={styles.summaryText}>{compactSummary}</Text>
            </Pressable>
          ) : (
            <View
              style={[
                styles.summaryExpandArea,
                !onPressSummarySearch && styles.summaryExpandAreaWithoutSearch,
              ]}
            >
              <Text numberOfLines={1} style={styles.summaryText}>{compactSummary}</Text>
            </View>
          )}
          {onPressExpandToggle ? (
            <AccountSelectorIconButton
              accessibilityLabel={expandButtonLabel}
              iconName={expandButtonIcon}
              immediate
              onPress={handlePressExpandToggle}
              size="summary"
              variant="plain"
            />
          ) : null}
        </View>
      ) : (
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            <Text numberOfLines={1} style={styles.detail}>{summaryDetail}</Text>
          </View>
          <View style={styles.actions}>
            <AccountSelectorAction
              disabled={allSelected}
              immediate={immediateSelectionEnabled}
              label="All"
              onCancelPreview={immediateSelectionEnabled ? handleCancelSelectionPreview : undefined}
              onPress={immediateSelectionEnabled
                ? () => immediateSelection.commitPreviewedSelection(() => accountIds)
                : handleSelectAll}
              onPreviewPress={immediateSelectionEnabled
                ? () => immediateSelection.previewSelectedAccountIds(accountIds)
                : undefined}
            />
            <AccountSelectorAction
              disabled={!visualSelectedAccountIds.length}
              immediate={immediateSelectionEnabled}
              label="None"
              onCancelPreview={immediateSelectionEnabled ? handleCancelSelectionPreview : undefined}
              onPress={immediateSelectionEnabled
                ? () => immediateSelection.commitPreviewedSelection(() => [])
                : handleClearSelection}
              onPreviewPress={immediateSelectionEnabled
                ? () => immediateSelection.previewSelectedAccountIds([])
                : undefined}
            />
            {onPressExpandToggle ? (
              <AccountSelectorIconButton
                accessibilityLabel={expandButtonLabel}
                iconName={expandButtonIcon}
                immediate
                onPress={handlePressExpandToggle}
                variant="plain"
              />
            ) : null}
          </View>
        </View>
      )}

      {accounts.length ? (
        <AnimatedAccountListReveal
          expanded={mode !== 'summary'}
          revealHeight={revealHeight}
          revealOpacity={revealOpacity}
        >
          <ScrollView
            ref={accountListScrollRef}
            nestedScrollEnabled
            scrollEnabled={accountListScrollEnabled}
            showsVerticalScrollIndicator={accountListScrollEnabled}
            style={styles.accountListScroll}
            contentContainerStyle={styles.accountGrid}
          >
            {accounts.map((account) => (
              <AccountSelectorTile
                key={account.id}
                account={account}
                balanceMinor={balanceMinorByAccountId.get(account.id)}
                immediate={immediateSelectionEnabled}
                selected={selectedAccountIdSet.has(account.id)}
                tileBasis={tileBasis}
                visualSelectedAccountIdMap={immediateSelection.visualSelectedAccountIdMap}
                onCancelPreview={handleCancelSelectionPreview}
                onPress={() => handleToggleAccount(account.id)}
                onPreviewPress={() => immediateSelection.previewToggleAccount(account.id)}
                onPressCommit={() =>
                  immediateSelection.commitPreviewedSelection(() => immediateSelection.getToggledAccountIds(account.id))}
              />
            ))}
          </ScrollView>
        </AnimatedAccountListReveal>
      ) : (
        mode === 'summary' ? null : <Text style={styles.emptyText}>{emptyMessage}</Text>
      )}
    </Card>
  );
}

function getExpandButtonLabel(mode: CompactAccountSelectorMode): string {
  if (mode === 'expanded') {
    return 'Collapse accounts';
  }

  if (mode === 'summary') {
    return 'Expand accounts';
  }

  return 'Show all accounts';
}

function getNextAccountSelectorMode(mode: CompactAccountSelectorMode): CompactAccountSelectorMode {
  if (mode === 'summary') {
    return 'peek';
  }

  if (mode === 'peek') {
    return 'expanded';
  }

  return 'peek';
}

function getAccountListTargetHeightForMode({
  expandedAccountListHeight,
  fullAccountListHeight,
  listShouldScroll,
  mode,
}: {
  expandedAccountListHeight: number;
  fullAccountListHeight: number;
  listShouldScroll: boolean;
  mode: CompactAccountSelectorMode;
}): number {
  if (mode === 'summary') {
    return 0;
  }

  if (mode === 'expanded') {
    return expandedAccountListHeight;
  }

  return listShouldScroll ? SCROLLABLE_ACCOUNT_LIST_HEIGHT : fullAccountListHeight;
}

function AnimatedAccountListReveal({
  children,
  expanded,
  revealHeight,
  revealOpacity,
}: {
  children: ReactNode;
  expanded: boolean;
  revealHeight: SharedValue<number>;
  revealOpacity: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    height: revealHeight.value,
    opacity: revealOpacity.value,
    transform: [{ translateY: (1 - revealOpacity.value) * -4 }],
  }));

  return (
    <Animated.View
      accessibilityElementsHidden={!expanded}
      importantForAccessibility={expanded ? 'auto' : 'no-hide-descendants'}
      pointerEvents={expanded ? 'auto' : 'none'}
      style={[styles.accountListReveal, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

function getAccountListHeightForRows(rowCount: number): number {
  if (rowCount <= 0) {
    return 0;
  }

  return (
    rowCount * ACCOUNT_TILE_MIN_HEIGHT +
    Math.max(rowCount - 1, 0) * spacing.sm +
    ACCOUNT_GRID_BOTTOM_PADDING
  );
}

function AccountSelectorIconButton({
  accessibilityLabel,
  iconName,
  immediate = false,
  onPress,
  shape = 'circle',
  size = 'default',
  variant = 'secondary',
}: {
  accessibilityLabel: string;
  iconName: ComponentProps<typeof Ionicons>['name'];
  immediate?: boolean;
  onPress: () => void;
  shape?: 'circle' | 'roundedSquare';
  size?: 'default' | 'summary';
  variant?: 'plain' | 'secondary';
}) {
  const pressHandlers = useImmediatePressHandlers(onPress, immediate);

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      {...pressHandlers}
      style={({ pressed }) => [
        styles.iconButton,
        size === 'summary' && styles.summaryIconButton,
        shape === 'roundedSquare' && styles.roundedSquareIconButton,
        variant === 'plain' && styles.plainIconButton,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={iconName}
        size={17}
        color={colors.primaryDark}
      />
    </Pressable>
  );
}

function useImmediatePressHandlers(onPress: () => void, immediate: boolean) {
  const handledPressInRef = useRef(false);
  const clearHandledPressInTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHandledPressInTimeout = useCallback(() => {
    if (clearHandledPressInTimeoutRef.current) {
      clearTimeout(clearHandledPressInTimeoutRef.current);
      clearHandledPressInTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearHandledPressInTimeout, [clearHandledPressInTimeout]);

  const handlePressIn = useCallback(() => {
    if (!immediate) {
      return;
    }

    clearHandledPressInTimeout();
    handledPressInRef.current = true;
    onPress();
  }, [clearHandledPressInTimeout, immediate, onPress]);

  const handlePressOut = useCallback(() => {
    if (!immediate) {
      return;
    }

    clearHandledPressInTimeout();
    clearHandledPressInTimeoutRef.current = setTimeout(() => {
      handledPressInRef.current = false;
      clearHandledPressInTimeoutRef.current = null;
    }, 250);
  }, [clearHandledPressInTimeout, immediate]);

  const handlePress = useCallback(() => {
    if (immediate && handledPressInRef.current) {
      handledPressInRef.current = false;
      clearHandledPressInTimeout();
      return;
    }

    onPress();
  }, [clearHandledPressInTimeout, immediate, onPress]);

  return {
    onPress: handlePress,
    onPressIn: immediate ? handlePressIn : undefined,
    onPressOut: immediate ? handlePressOut : undefined,
  };
}

export function AccountSelectorAction({
  disabled,
  immediate = false,
  label,
  onCancelPreview,
  onPress,
  onPreviewPress,
}: {
  disabled: boolean;
  immediate?: boolean;
  label: string;
  onCancelPreview?: () => void;
  onPress: () => void;
  onPreviewPress?: () => void;
}) {
  const pressHandlers = useTapIntentPressHandlers({
    enabled: Boolean(immediate && !disabled && onPreviewPress && onCancelPreview),
    onCancel: onCancelPreview ?? noopPressHandler,
    onCommit: onPress,
    onPreview: onPreviewPress ?? noopPressHandler,
  });

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      {...pressHandlers}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function AccountSelectorTile({
  account,
  balanceMinor,
  immediate,
  onCancelPreview,
  selected,
  tileBasis,
  visualSelectedAccountIdMap,
  onPress,
  onPressCommit,
  onPreviewPress,
}: {
  account: Account;
  balanceMinor?: number;
  immediate: boolean;
  onCancelPreview: () => void;
  selected: boolean;
  tileBasis: AccountTileBasis;
  visualSelectedAccountIdMap: SharedValue<AccountSelectionMap>;
  onPress: () => void;
  onPressCommit: () => void;
  onPreviewPress: () => void;
}) {
  const accountName = getAccountDisplayName(account);
  const balanceLabel = getAccountSelectionBalanceLabel(account, balanceMinor);
  const selectedBackgroundColor = getTransparentColor(account.themeColor, '38');
  const unselectedBorderColor = getTransparentColor(account.themeColor, '99');
  const animatedSelectionStyle = useAnimatedStyle(() => {
    const visuallySelected = Boolean(visualSelectedAccountIdMap.value[account.id]);
    return {
      backgroundColor: visuallySelected ? selectedBackgroundColor : colors.surface,
      borderColor: visuallySelected ? account.themeColor : unselectedBorderColor,
    };
  }, [account.id, account.themeColor, selectedBackgroundColor, unselectedBorderColor, visualSelectedAccountIdMap]);
  const pressHandlers = useTapIntentPressHandlers({
    enabled: immediate,
    onCancel: onCancelPreview,
    onCommit: immediate ? onPressCommit : onPress,
    onPreview: onPreviewPress,
  });

  return (
    <Pressable
      accessibilityLabel={`${accountName}, ${account.currencyCode}, ${selected ? 'selected' : 'not selected'}`}
      accessibilityRole="button"
      {...pressHandlers}
      style={({ pressed }) => [styles.tileFrame, { width: tileBasis }, pressed && styles.pressed]}
      testID={`account-selector-${account.id}`}
    >
      <Animated.View
        style={[
          styles.tileContent,
        {
          borderLeftColor: account.themeColor,
        },
          animatedSelectionStyle,
        ]}
      >
        <Text numberOfLines={1} style={styles.accountName}>
          {accountName}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.accountBalance}>
          {balanceLabel}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '900',
  },
  actions: {
    alignItems: 'center',
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  accountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingBottom: ACCOUNT_GRID_BOTTOM_PADDING,
  },
  accountListReveal: {
    overflow: 'hidden',
  },
  accountListScroll: {
    flex: 1,
  },
  accountName: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '800',
    textAlign: 'right',
    width: '100%',
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  accountBalance: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'right',
    width: '100%',
  },
  detail: {
    color: colors.muted,
    fontSize: typography.small,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
  emptyText: {
    color: colors.muted,
    fontSize: typography.body,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.faint,
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.78,
  },
  plainIconButton: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  roundedSquareIconButton: {
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 0,
    marginLeft: -spacing.md,
  },
  summaryCard: {
    gap: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 36,
  },
  summaryExpandArea: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 36,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  summaryExpandAreaWithoutSearch: {
    paddingLeft: 0,
  },
  summaryIconButton: {
    height: 36,
    width: 36,
  },
  summaryText: {
    color: colors.muted,
    flex: 1,
    fontSize: typography.small,
    fontWeight: '800',
    minWidth: 0,
  },
  tileContent: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderLeftWidth: 5,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: ACCOUNT_TILE_MIN_HEIGHT,
    minWidth: RESPONSIVE_ACCOUNT_TILE_MIN_WIDTH,
    padding: spacing.sm,
    width: '100%',
  },
  tileFrame: {
    minHeight: ACCOUNT_TILE_MIN_HEIGHT,
    minWidth: RESPONSIVE_ACCOUNT_TILE_MIN_WIDTH,
  },
  title: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '800',
  },
});
