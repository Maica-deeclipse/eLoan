import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import WelcomeScreen from './src/navigations/screens/WelcomeScreen';
import LoginScreen from './src/navigations/screens/LoginScreen';
import SignupScreen from './src/navigations/screens/SignupScreen';
import HomeScreen from './src/navigations/screens/HomeScreen';
import AnalyticsScreen from './src/navigations/screens/AnalyticsScreen';
import ProfileScreen from './src/navigations/screens/ProfileScreen';
import SettingsScreen from './src/navigations/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Welcome" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}
