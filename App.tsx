import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RainproofDataProvider } from './src/application/RainproofDataProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={Platform.OS === 'android' ? 'light' : 'dark'} />
      <SafeAreaProvider>
        <RainproofDataProvider>
          <NavigationContainer>
            <RootNavigator />
          </NavigationContainer>
        </RainproofDataProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
