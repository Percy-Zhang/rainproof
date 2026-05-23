import { Ionicons } from '@expo/vector-icons';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';

import { useRainproofDataContext } from '../application/RainproofDataProvider';
import { CategorySettingsDraftProvider } from '../features/settings/CategorySettingsDraftContext';
import { colors, spacing, typography } from '../theme/tokens';
import {
  AccountsDrawerScreen,
  HomeDrawerScreen,
  SettingsDrawerScreen,
  StatisticsDrawerScreen,
  TransactionsDrawerScreen,
} from './LegacyDrawerScreen';
import type { MainDrawerParamList, RootStackParamList } from './routes';
import {
  CategoryEditRouteScreen,
  CategoryManagementRouteScreen,
  SubcategoryEditRouteScreen,
} from './CategorySettingsRouteScreens';
import {
  AddAccountRouteScreen,
  AddTransactionRouteScreen,
  EditAccountRouteScreen,
  EditTransactionRouteScreen,
  LinkTransactionRouteScreen,
  RainyDayFundRouteScreen,
} from './RootStackScreens';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<MainDrawerParamList>();

export function RootNavigator() {
  return (
    <CategorySettingsDraftProvider>
      <RootStack.Navigator
        initialRouteName="MainDrawer"
        screenOptions={{
          headerShown: false,
          headerStyle: styles.header,
          headerTintColor: colors.primaryDark,
          headerTitleStyle: styles.headerTitle,
        }}
      >
        <RootStack.Screen name="MainDrawer" component={MainDrawerNavigator} />
        <RootStack.Screen name="AddAccount" component={AddAccountRouteScreen} />
        <RootStack.Screen name="EditAccount" component={EditAccountRouteScreen} />
        <RootStack.Screen name="AddTransaction" component={AddTransactionRouteScreen} />
        <RootStack.Screen name="EditTransaction" component={EditTransactionRouteScreen} />
        <RootStack.Screen name="LinkTransaction" component={LinkTransactionRouteScreen} />
        <RootStack.Screen
          name="RainyDayFund"
          component={RainyDayFundRouteScreen}
          options={{ headerShown: true, title: 'Rainy day fund' }}
        />
        <RootStack.Screen
          name="CategoryManagement"
          component={CategoryManagementRouteScreen}
          options={{ headerShown: true, title: 'Edit categories' }}
        />
        <RootStack.Screen
          name="CategoryEdit"
          component={CategoryEditRouteScreen}
          options={{ headerShown: true, title: 'Edit category' }}
        />
        <RootStack.Screen
          name="SubcategoryEdit"
          component={SubcategoryEditRouteScreen}
          options={{ headerShown: true, title: 'Edit subcategory' }}
        />
      </RootStack.Navigator>
    </CategorySettingsDraftProvider>
  );
}

function MainDrawerNavigator() {
  const { saving } = useRainproofDataContext();

  return (
    <Drawer.Navigator
      initialRouteName="Home"
      screenOptions={{
        drawerActiveBackgroundColor: colors.surfaceMuted,
        drawerActiveTintColor: colors.primaryDark,
        drawerInactiveTintColor: colors.muted,
        drawerLabelStyle: styles.drawerLabel,
        drawerStyle: styles.drawer,
        headerRight: () => (saving ? <Text style={styles.saving}>Saving</Text> : null),
        headerRightContainerStyle: styles.headerRight,
        headerStyle: styles.header,
        headerTintColor: colors.primaryDark,
        headerTitleStyle: styles.headerTitle,
      }}
    >
      <Drawer.Screen
        name="Home"
        component={HomeDrawerScreen}
        options={{
          drawerIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} />,
          drawerLabel: 'Home',
          title: 'Rainproof',
        }}
      />
      <Drawer.Screen
        name="Accounts"
        component={AccountsDrawerScreen}
        options={{
          drawerIcon: ({ color, size }) => <Ionicons name="wallet-outline" color={color} size={size} />,
          title: 'Accounts',
        }}
      />
      <Drawer.Screen
        name="Transactions"
        component={TransactionsDrawerScreen}
        options={{
          drawerIcon: ({ color, size }) => <Ionicons name="receipt-outline" color={color} size={size} />,
          title: 'Transactions',
        }}
      />
      <Drawer.Screen
        name="Statistics"
        component={StatisticsDrawerScreen}
        options={{
          drawerIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" color={color} size={size} />,
          title: 'Statistics',
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsDrawerScreen}
        options={{
          drawerIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} />,
          title: 'Settings',
        }}
      />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: colors.background,
  },
  drawerLabel: {
    fontSize: typography.body,
    fontWeight: '800',
  },
  header: {
    backgroundColor: colors.background,
  },
  headerRight: {
    paddingRight: spacing.md,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: typography.h3,
    fontWeight: '900',
  },
  saving: {
    color: colors.primaryDark,
    fontSize: typography.small,
    fontWeight: '800',
  },
});
