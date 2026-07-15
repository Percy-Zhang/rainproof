import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CategoryIconBadge } from '../../components/CategoryDisplay';
import type {
  ExpenseLinkTargetCandidateView,
  IncomeLinkSourceCandidateView,
} from '../../domain/transactionLinkCandidateModel';
import { sharedStyles } from '../../theme/sharedStyles';
import { colors, spacing, typography } from '../../theme/tokens';
import { LinkedTransactionIndicator } from './LinkedTransactionIndicator';

const CANDIDATE_REVEAL_DURATION_MS = 150;
const candidateLayoutTransition = LinearTransition
  .duration(CANDIDATE_REVEAL_DURATION_MS)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);
const candidateEntering = FadeInDown
  .duration(CANDIDATE_REVEAL_DURATION_MS)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);
const candidateExiting = FadeOutUp
  .duration(120)
  .easing(Easing.in(Easing.cubic))
  .reduceMotion(ReduceMotion.System);

type LinkCandidate = ExpenseLinkTargetCandidateView | IncomeLinkSourceCandidateView;

type TransactionLinkCandidateGroupProps<T extends LinkCandidate> = {
  candidate: T;
  expanded: boolean;
  onPress: (candidate: T) => void;
  onToggle: (candidateId: string) => void;
  children: ReactNode;
};

function TransactionLinkCandidateGroupComponent<T extends LinkCandidate>({
  candidate,
  expanded,
  onPress,
  onToggle,
  children,
}: TransactionLinkCandidateGroupProps<T>) {
  const expandable = candidate.parentKind !== 'parent';
  const presentation = candidate.presentation;
  const chevronProgress = useSharedValue(expanded ? 1 : 0);
  const visualExpandedRef = useRef(expanded);

  const animateChevron = useCallback((nextExpanded: boolean) => {
    visualExpandedRef.current = nextExpanded;
    cancelAnimation(chevronProgress);
    chevronProgress.value = withTiming(nextExpanded ? 1 : 0, {
      duration: CANDIDATE_REVEAL_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [chevronProgress]);

  useEffect(() => {
    if (visualExpandedRef.current !== expanded) {
      animateChevron(expanded);
    }
  }, [animateChevron, expanded]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronProgress.value * 180}deg` }],
  }));

  function handlePress() {
    if (expandable) {
      animateChevron(!visualExpandedRef.current);
      onToggle(candidate.transaction.id);
      return;
    }
    onPress(candidate);
  }

  return (
    <Animated.View
      layout={expanded ? candidateLayoutTransition : undefined}
      style={styles.group}
      testID={`link-candidate-${candidate.transaction.id}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={expandable ? { expanded } : undefined}
        disabled={!expandable && !candidate.selectable}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.parentRow,
          !candidate.selectable && !expandable && styles.disabled,
          pressed && sharedStyles.pressed,
        ]}
        testID={`link-candidate-${candidate.transaction.id}-card`}
      >
        <CategoryIconBadge
          color={presentation.iconColor ?? colors.primaryDark}
          icon={presentation.iconName ?? 'git-branch-outline'}
          size="md"
        />
        <View style={styles.parentText}>
          <Text numberOfLines={1} style={styles.parentTitle}>{presentation.title}</Text>
          <Text numberOfLines={1} style={styles.parentKind}>{presentation.parentLabel}</Text>
          <Text numberOfLines={1} style={styles.remaining}>{presentation.statusLabel}</Text>
          {presentation.accountName !== null ? (
            <Text numberOfLines={1} style={styles.account}>{presentation.accountName}</Text>
          ) : null}
        </View>
        <View style={styles.parentEnd}>
          {candidate.status.status === 'settled' ? (
            <LinkedTransactionIndicator compact testID={`settled-link-candidate-${candidate.transaction.id}`} />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              styles.amount,
              presentation.amountTone === 'positive'
                ? styles.incomeAmount
                : presentation.amountTone === 'negative'
                  ? styles.expenseAmount
                  : styles.neutralAmount,
            ]}
          >
            {presentation.amountLabel}
          </Text>
          <Text style={styles.date}>{presentation.dateLabel}</Text>
          {expandable ? (
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-down" size={18} color={colors.muted} />
            </Animated.View>
          ) : null}
        </View>
      </Pressable>
      {expanded ? (
        <Animated.View
          accessibilityElementsHidden={!expanded}
          entering={candidateEntering}
          exiting={candidateExiting}
          importantForAccessibility="auto"
          style={styles.scopeChildren}
          testID={`link-candidate-scopes-${candidate.transaction.id}`}
        >
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export const TransactionLinkCandidateGroup = memo(
  TransactionLinkCandidateGroupComponent,
) as typeof TransactionLinkCandidateGroupComponent;

const styles = StyleSheet.create({
  account: { color: colors.muted, fontSize: typography.small },
  amount: { fontSize: typography.body, fontWeight: '900' },
  date: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  expenseAmount: { color: colors.danger },
  group: { gap: spacing.xs },
  incomeAmount: { color: colors.success },
  neutralAmount: { color: colors.ink },
  parentEnd: { alignItems: 'flex-end', flexShrink: 0, gap: 2, maxWidth: '38%' },
  parentKind: { color: colors.muted, fontSize: typography.small, fontWeight: '800' },
  parentRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 78,
    padding: spacing.sm,
  },
  parentText: { flex: 1, gap: 2, minWidth: 0 },
  parentTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  remaining: { color: colors.primaryDark, fontSize: typography.small, fontWeight: '900' },
  scopeChildren: {
    borderLeftColor: colors.faint,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    gap: spacing.xs,
    marginHorizontal: spacing.xs,
    padding: spacing.xs,
    paddingLeft: spacing.md,
  },
});
