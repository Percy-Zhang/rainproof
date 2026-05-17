import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { getAccountDisplayName } from '../domain/accountThemes';
import {
  getHorizontalScrollEdges,
  getNextHorizontalOffset,
  type HorizontalScrollMetrics,
} from '../domain/horizontalScroll';
import type { Account } from '../domain/types';
import { colors, spacing } from '../theme/tokens';
import { Chip } from './ui';

const initialScrollMetrics: HorizontalScrollMetrics = {
  contentWidth: 0,
  layoutWidth: 0,
  offsetX: 0,
};

type AccountFilterCarouselProps = {
  accounts: Account[];
  allSelected: boolean;
  selectedAccountIds: string[];
  showCurrencyCodes: boolean;
  onPressAll: () => void;
  onPressAccount: (accountId: string) => void;
  getAccountLabel?: (account: Account, showCurrencyCodes: boolean) => string;
};

export function AccountFilterCarousel({
  accounts,
  allSelected,
  selectedAccountIds,
  showCurrencyCodes,
  onPressAll,
  onPressAccount,
  getAccountLabel = defaultAccountLabel,
}: AccountFilterCarouselProps) {
  const accountScrollRef = useRef<ScrollView>(null);
  const [scrollMetrics, setScrollMetrics] = useState<HorizontalScrollMetrics>(initialScrollMetrics);
  const scrollEdges = getHorizontalScrollEdges(scrollMetrics);
  const selectedAccountIdSet = new Set(selectedAccountIds);

  function scrollAccountsBy(direction: -1 | 1) {
    const step = Math.max(140, scrollMetrics.layoutWidth * 0.65);
    const x = getNextHorizontalOffset(scrollMetrics, direction, step);
    accountScrollRef.current?.scrollTo({ animated: true, x });
  }

  function handleAccountCarouselLayout(event: LayoutChangeEvent) {
    const layoutWidth = event.nativeEvent.layout.width;
    setScrollMetrics((currentMetrics) => ({ ...currentMetrics, layoutWidth }));
  }

  function handleAccountScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offsetX = event.nativeEvent.contentOffset.x;
    setScrollMetrics((currentMetrics) => ({ ...currentMetrics, offsetX }));
  }

  return (
    <ScrollViewWrapper>
      {scrollEdges.canScrollLeft ? (
        <Pressable
          accessibilityLabel="Previous accounts"
          accessibilityRole="button"
          onPress={() => scrollAccountsBy(-1)}
          style={({ pressed }) => [styles.accountHintLeft, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={15} color={colors.primaryDark} />
        </Pressable>
      ) : null}
      <ScrollView
        ref={accountScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        onContentSizeChange={(contentWidth) =>
          setScrollMetrics((currentMetrics) => ({ ...currentMetrics, contentWidth }))
        }
        onLayout={handleAccountCarouselLayout}
        onScroll={handleAccountScroll}
        scrollEventThrottle={16}
      >
        <Chip selected={allSelected} onPress={onPressAll}>
          All
        </Chip>
        {accounts.map((account) => (
          <Chip
            key={account.id}
            selected={selectedAccountIdSet.has(account.id)}
            onPress={() => onPressAccount(account.id)}
          >
            {getAccountLabel(account, showCurrencyCodes)}
          </Chip>
        ))}
      </ScrollView>
      {scrollEdges.canScrollRight ? (
        <Pressable
          accessibilityLabel="Next accounts"
          accessibilityRole="button"
          onPress={() => scrollAccountsBy(1)}
          style={({ pressed }) => [styles.accountHintRight, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-forward" size={15} color={colors.primaryDark} />
        </Pressable>
      ) : null}
    </ScrollViewWrapper>
  );
}

function ScrollViewWrapper({ children }: { children: ReactNode }) {
  return <View style={styles.accountCarousel}>{children}</View>;
}

function defaultAccountLabel(account: Account, showCurrencyCodes: boolean): string {
  return showCurrencyCodes
    ? `${getAccountDisplayName(account)} (${account.currencyCode})`
    : getAccountDisplayName(account);
}

const styles = StyleSheet.create({
  accountCarousel: {
    position: 'relative',
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
  },
  accountHintLeft: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    bottom: spacing.xs,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    top: spacing.xs,
    width: 24,
    zIndex: 2,
  },
  accountHintRight: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    bottom: spacing.xs,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    top: spacing.xs,
    width: 24,
    zIndex: 2,
  },
  pressed: {
    opacity: 0.78,
  },
});
