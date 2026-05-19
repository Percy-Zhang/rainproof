import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RainproofDataProvider } from './src/application/RainproofDataProvider';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
