import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API URL Configuration
 * Handles different environments (dev, production) and platforms (Android, iOS)
 */
const getApiUrl = () => {
  // 1. Check environment variable from app.json extra config
  const envApiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (envApiUrl) {
    return envApiUrl;
  }

  // 2. Platform-specific defaults for local development
  // Android emulator uses 10.0.2.2 to access host machine's localhost
  // iOS simulator can use localhost directly
  const isAndroid = Platform.OS === 'android';

  if (__DEV__) {
    // 10.0.2.2 is the standard Android emulator address for the host machine's localhost.
    // For physical device testing, set EXPO_PUBLIC_API_URL in your .env file instead.
    return isAndroid
      ? 'http://192.168.100.17:8000/api/auth'
      : 'http://localhost:8000/api/auth';
  }

  // 3. Production fallback (configure this for production deployment)
  return 'https://your-production-api.com/api/auth';
};

export const API_URL = getApiUrl();

// Log the resolved API URL so it's visible in Metro/Expo logs on every app start
console.log('[API_CONFIG] ✅ API_URL resolved to:', API_URL);
console.log('[API_CONFIG]    Platform:', Platform.OS);
console.log('[API_CONFIG]    __DEV__:', __DEV__);
console.log('[API_CONFIG]    env apiUrl override:', Constants.expoConfig?.extra?.apiUrl ?? '(none — using fallback)');

// Export debugging information
export const getDebugInfo = () => ({
  apiUrl: API_URL,
  platform: Platform.OS,
  isDev: __DEV__,
  extra: Constants.expoConfig?.extra,
});
