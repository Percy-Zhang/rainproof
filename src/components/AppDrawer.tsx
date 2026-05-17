import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme/tokens';

export type DrawerNavigationItem<T extends string = string> = {
  key: T;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type AppDrawerProps<T extends string> = {
  items: DrawerNavigationItem<T>[];
  onClose: () => void;
  onNavigate: (screenKey: T) => void;
  selectedKey: T;
  settingsItem: DrawerNavigationItem<T>;
  visible: boolean;
};

export function AppDrawer<T extends string>({
  items,
  onClose,
  onNavigate,
  selectedKey,
  settingsItem,
  visible,
}: AppDrawerProps<T>) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerOverlay}>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={styles.drawerScrim}
          testID="close-drawer-overlay"
        />
        <View style={styles.drawerPanel} testID="navigation-drawer">
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerTitle}>Rainproof</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.drawerClose, pressed && styles.pressed]}
              testID="close-drawer"
            >
              <Ionicons name="close-outline" size={24} color={colors.primaryDark} />
            </Pressable>
          </View>

          <View style={styles.drawerNav}>
            {items.map((item) => (
              <DrawerItem
                key={item.key}
                item={item}
                selected={selectedKey === item.key}
                onPress={() => onNavigate(item.key)}
              />
            ))}
          </View>

          <View style={styles.drawerFooter}>
            <DrawerItem
              item={settingsItem}
              selected={selectedKey === settingsItem.key}
              onPress={() => onNavigate(settingsItem.key)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DrawerItem<T extends string>({
  item,
  selected,
  onPress,
}: {
  item: DrawerNavigationItem<T>;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.drawerItem,
        selected && styles.drawerItemSelected,
        pressed && styles.pressed,
      ]}
      testID={`drawer-${item.key}`}
    >
      <Ionicons
        name={item.icon}
        size={22}
        color={selected ? colors.primaryDark : colors.muted}
      />
      <Text style={[styles.drawerItemText, selected && styles.drawerItemTextSelected]}>
        {item.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerScrim: {
    backgroundColor: 'rgba(15, 47, 70, 0.32)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  drawerPanel: {
    backgroundColor: colors.background,
    borderRightColor: colors.faint,
    borderRightWidth: 1,
    elevation: 8,
    maxWidth: 320,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    shadowColor: colors.shadow,
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    width: '58%',
  },
  drawerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  drawerTitle: {
    color: colors.ink,
    fontSize: typography.h2,
    fontWeight: '900',
  },
  drawerClose: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  drawerNav: {
    gap: spacing.sm,
  },
  drawerFooter: {
    borderTopColor: colors.faint,
    borderTopWidth: 1,
    marginTop: 'auto',
    paddingTop: spacing.md,
  },
  drawerItem: {
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  drawerItemSelected: {
    backgroundColor: colors.surfaceMuted,
  },
  drawerItemText: {
    color: colors.muted,
    fontSize: typography.body,
    fontWeight: '800',
  },
  drawerItemTextSelected: {
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.78,
  },
});
