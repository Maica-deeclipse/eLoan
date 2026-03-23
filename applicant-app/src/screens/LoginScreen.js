import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const { googleLogin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Constants.expoConfig?.extra?.googleClientId,
    androidClientId: Constants.expoConfig?.extra?.googleAndroidClientId,
    iosClientId: Constants.expoConfig?.extra?.googleIosClientId,
    scopes: ['openid', 'profile', 'email'],
    prompt: 'select_account',
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      handleGoogleToken(access_token);
    } else if (response?.type === 'error') {
      setLoading(false);
      setError('Google sign-in was cancelled or failed.');
    } else if (response?.type === 'dismiss') {
      setLoading(false);
    }
  }, [response]);

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    await promptAsync();
  };

  const handleGoogleToken = async (accessToken) => {
    try {
      const result = await googleLogin(accessToken);
      if (!result.success) {
        if (result.isPending) {
          setError(
            result.isNew
              ? 'Account created! Your account is pending admin approval. You will be notified once approved.'
              : result.message || 'Your account is pending approval.'
          );
        } else {
          setError(result.error || 'Google sign-in failed.');
        }
      }
    } catch {
      setError('Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>💰</Text>
            <Text style={styles.logoText}>eLoan</Text>
          </View>
          <Text style={styles.title}>Login to Your Account</Text>
          <Text style={styles.subtitle}>Use your BukSU Google account to sign in</Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Google Sign-In Button */}
        <TouchableOpacity
          style={[styles.googleButton, (loading || !request) && styles.googleButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={loading || !request}
        >
          {loading ? (
            <ActivityIndicator color="#374151" />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.googleHint}>Only @buksu.edu.ph accounts are accepted</Text>

        {/* Register Link */}
        <View style={styles.registerContainer}>
          <Text style={styles.registerText}>New BukSU member? </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Register')}
            disabled={loading}
          >
            <Text style={styles.registerLink}>Register with Google</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            eLoan Management System • Applicant Access
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoIcon: {
    fontSize: 40,
    marginRight: 8,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    lineHeight: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  googleButtonDisabled: {
    opacity: 0.5,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
    marginRight: 10,
  },
  googleButtonText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  googleHint: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 32,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    color: '#6b7280',
    fontSize: 14,
  },
  registerLink: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    color: '#6b7280',
    fontSize: 12,
  },
});
