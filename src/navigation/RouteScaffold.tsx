import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ComposerScreenScaffold } from '../components/ScreenScaffold';
import { FormError } from '../components/ui';
import { colors, spacing, typography } from '../theme/tokens';

export const PREPARING_RAINPROOF_MESSAGE = 'Preparing Rainproof';

export function RouteSafeArea({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <SafeAreaView style={styles.safeArea} testID={testID}>
      {children}
    </SafeAreaView>
  );
}

export function RouteMessageShell({ message }: { message: string }) {
  return (
    <RouteSafeArea>
      <FormError message={message} />
    </RouteSafeArea>
  );
}

export function ComposerRouteScaffold({
  children,
  screenKey,
}: {
  children: ReactNode;
  screenKey: string;
}) {
  return (
    <RouteSafeArea>
      <ComposerScreenScaffold screenKey={screenKey}>
        {children}
      </ComposerScreenScaffold>
    </RouteSafeArea>
  );
}

export function RouteTopBar({
  onBack,
  right,
  title,
}: {
  onBack: () => void;
  right?: ReactNode;
  title: string;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.primaryDark} />
        <Text style={styles.backButtonText}>Back</Text>
      </Pressable>
      <Text numberOfLines={1} style={styles.title}>{title}</Text>
      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
    paddingRight: spacing.sm,
    width: 88,
  },
  backButtonText: {
    color: colors.primaryDark,
    fontSize: typography.body,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
  rightSlot: {
    alignItems: 'flex-end',
    width: 88,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  title: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.h3,
    fontWeight: '900',
    textAlign: 'center',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
});

export const routeScaffoldStyles = {
  pressed: styles.pressed,
};
