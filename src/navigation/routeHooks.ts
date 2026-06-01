import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { DrawerNavigationProp } from '@react-navigation/drawer';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MainDrawerParamList, RootStackParamList } from './routes';

export type RootStackNavigation = NativeStackNavigationProp<RootStackParamList>;
export type MainDrawerNavigation = DrawerNavigationProp<MainDrawerParamList>;

export function useRootStackNavigation(): RootStackNavigation {
  return useNavigation<RootStackNavigation>();
}

export function useRootStackRoute<RouteName extends keyof RootStackParamList>() {
  return useRoute<RouteProp<RootStackParamList, RouteName>>();
}

export function useMainDrawerNavigation(): MainDrawerNavigation {
  return useNavigation<MainDrawerNavigation>();
}
