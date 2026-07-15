import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, spacing, typography } from '../theme/tokens';

type TransactionQuickActionsProps = {
  bottom: number;
  context: 'dashboard' | 'transactions';
  onAddTransaction: (params?: { dashboardAccountIds?: string[] }) => void;
  onOpenTemplates: () => void;
  selectedAccountIds: string[];
};

type QuickAction = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  testID: string;
};

const QUICK_ACTION_DURATION_MS = 160;
const QUICK_ACTION_ROW_DISTANCE = 52;

export const TransactionQuickActions = memo(function TransactionQuickActions({
  bottom,
  context,
  onAddTransaction,
  onOpenTemplates,
  selectedAccountIds,
}: TransactionQuickActionsProps) {
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [quickActionsMounted, setQuickActionsMounted] = useState(false);
  const quickActionsOpenRef = useRef(false);
  const componentMountedRef = useRef(true);
  const progress = useSharedValue(0);
  const testIDPrefix = context === 'dashboard' ? 'dashboard' : 'transactions';
  const accessibilityContext = context === 'dashboard' ? 'dashboard' : 'transaction';

  const finishClose = useCallback(() => {
    if (componentMountedRef.current && !quickActionsOpenRef.current) {
      setQuickActionsMounted(false);
    }
  }, []);

  const animateQuickActions = useCallback((nextOpen: boolean) => {
    quickActionsOpenRef.current = nextOpen;
    cancelAnimation(progress);
    progress.value = withTiming(nextOpen ? 1 : 0, {
      duration: QUICK_ACTION_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    }, (finished) => {
      if (finished && !nextOpen) {
        scheduleOnRN(finishClose);
      }
    });

    if (nextOpen) {
      setQuickActionsMounted(true);
    }
    setQuickActionsOpen(nextOpen);
  }, [finishClose, progress]);

  const closeQuickActions = useCallback(() => {
    animateQuickActions(false);
  }, [animateQuickActions]);

  const toggleQuickActions = useCallback(() => {
    animateQuickActions(!quickActionsOpenRef.current);
  }, [animateQuickActions]);

  const openAddTransaction = useCallback(() => {
    closeQuickActions();
    onAddTransaction({ dashboardAccountIds: selectedAccountIds });
  }, [closeQuickActions, onAddTransaction, selectedAccountIds]);

  const openTemplates = useCallback(() => {
    closeQuickActions();
    onOpenTemplates();
  }, [closeQuickActions, onOpenTemplates]);

  useEffect(() => {
    if (!quickActionsOpen) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeQuickActions();
      return true;
    });

    return () => subscription.remove();
  }, [closeQuickActions, quickActionsOpen]);

  useEffect(() => {
    componentMountedRef.current = true;

    return () => {
      componentMountedRef.current = false;
      cancelAnimation(progress);
    };
  }, [progress]);

  const addAction: QuickAction = {
    icon: 'receipt-outline',
    label: 'Add Transaction',
    onPress: openAddTransaction,
    testID: `${testIDPrefix}-quick-action-add-transaction`,
  };
  const templateAction: QuickAction = {
    icon: 'flash-outline',
    label: 'Use Template',
    onPress: openTemplates,
    testID: `${testIDPrefix}-quick-action-use-template`,
  };
  const actions = context === 'transactions'
    ? [addAction, templateAction]
    : [templateAction, addAction];

  return (
    <>
      {quickActionsOpen ? (
        <Pressable
          accessibilityLabel={`Close ${accessibilityContext} quick actions`}
          accessibilityRole="button"
          onPress={closeQuickActions}
          style={styles.quickActionBackdrop}
          testID={`${testIDPrefix}-quick-action-backdrop`}
        />
      ) : null}
      {quickActionsMounted ? (
        <View
          accessibilityElementsHidden={!quickActionsOpen}
          importantForAccessibility={quickActionsOpen ? 'auto' : 'no-hide-descendants'}
          pointerEvents={quickActionsOpen ? 'box-none' : 'none'}
          style={[styles.quickActionMenu, { bottom: bottom + 68 }]}
          testID={`${testIDPrefix}-quick-action-menu`}
        >
          {actions.map((action, index) => (
            <TransactionQuickAction
              key={action.testID}
              action={action}
              distance={(actions.length - index) * QUICK_ACTION_ROW_DISTANCE}
              progress={progress}
            />
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityLabel={quickActionsOpen
          ? `Close ${accessibilityContext} quick actions`
          : `Open ${accessibilityContext} quick actions`}
        accessibilityHint="Shows actions for adding a transaction or using a template."
        accessibilityRole="button"
        accessibilityState={{ expanded: quickActionsOpen }}
        onPress={toggleQuickActions}
        style={({ pressed }) => [
          styles.floatingAddButton,
          { bottom },
          pressed && styles.pressedRow,
        ]}
        testID={`${testIDPrefix}-add-transaction`}
      >
        <AnimatedQuickActionMainIcon progress={progress} />
      </Pressable>
    </>
  );
});

function AnimatedQuickActionMainIcon({
  progress,
}: {
  progress: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 45}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name="add" size={30} color={colors.surface} />
    </Animated.View>
  );
}

function TransactionQuickAction({
  action,
  distance,
  progress,
}: {
  action: QuickAction;
  distance: number;
  progress: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const visibleProgress = interpolate(
      progress.value,
      [0, 0.18, 1],
      [0, 0.08, 1],
      Extrapolation.CLAMP,
    );

    return {
      opacity: visibleProgress,
      transform: [
        { translateY: (1 - visibleProgress) * distance },
        { scale: 0.82 + visibleProgress * 0.18 },
      ],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        accessibilityLabel={action.label}
        accessibilityRole="button"
        onPress={action.onPress}
        style={({ pressed }) => [styles.quickActionRow, pressed && styles.pressedRow]}
        testID={action.testID}
      >
        <View style={styles.quickActionLabelPill}>
          <Text style={styles.quickActionLabel}>{action.label}</Text>
        </View>
        <View style={styles.quickActionIconButton}>
          <Ionicons name={action.icon} size={20} color={colors.surface} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingAddButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    elevation: 7,
    height: 58,
    justifyContent: 'center',
    position: 'absolute',
    right: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    width: 58,
    zIndex: 20,
  },
  pressedRow: {
    opacity: 0.78,
  },
  quickActionBackdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 18,
  },
  quickActionIconButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    elevation: 5,
    height: 44,
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    width: 44,
  },
  quickActionLabel: {
    color: colors.ink,
    fontSize: typography.small,
    fontWeight: '900',
  },
  quickActionLabelPill: {
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  quickActionMenu: {
    alignItems: 'flex-end',
    gap: spacing.sm,
    position: 'absolute',
    right: spacing.lg + 7,
    zIndex: 22,
  },
  quickActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    minHeight: 48,
  },
});
