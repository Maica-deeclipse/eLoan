import { Text, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// Poppins Regular as the global default for all Text — explicit fontFamily styles override this.
Text.defaultProps = Text.defaultProps || {};
Text.defaultProps.style = { fontFamily: 'Poppins_400Regular' };

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_300Light:     require('./assets/fonts/Poppins_300Light.ttf'),
    Poppins_400Regular:   require('./assets/fonts/Poppins_400Regular.ttf'),
    Poppins_500Medium:    require('./assets/fonts/Poppins_500Medium.ttf'),
    Poppins_600SemiBold:  require('./assets/fonts/Poppins_600SemiBold.ttf'),
    Poppins_700Bold:      require('./assets/fonts/Poppins_700Bold.ttf'),
    Poppins_800ExtraBold: require('./assets/fonts/Poppins_800ExtraBold.ttf'),
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EEF4FF' }}>
        <ActivityIndicator size="large" color="#0f1c52" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
