import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { ResponseType } from 'expo-auth-session';
import Constants from 'expo-constants';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';

WebBrowser.maybeCompleteAuthSession();

export default function RegisterScreen({ navigation }) {
  const { googleLogin } = useAuth();
  const [mode, setMode] = useState('google'); // 'google' | 'manual'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Manual form state
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: Constants.expoConfig?.extra?.googleClientId,
    androidClientId: Constants.expoConfig?.extra?.googleAndroidClientId,
    iosClientId: Constants.expoConfig?.extra?.googleIosClientId,
    scopes: ['openid', 'profile', 'email'],
    responseType: ResponseType.Token,
    usePKCE: false,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      handleGoogleToken(access_token);
    } else if (response?.type === 'error') {
      setLoading(false);
      setError('Google sign-in was cancelled or failed. Please try again.');
    } else if (response?.type === 'dismiss') {
      setLoading(false);
    }
  }, [response]);

  const handleGoogleRegister = async () => {
    setError('');
    setLoading(true);
    await promptAsync();
  };

  const handleGoogleToken = async (accessToken) => {
    try {
      const result = await googleLogin(accessToken);
      if (result.success) return;
      if (result.isPending && result.isNew) { setSuccess(true); return; }
      if (result.isPending) {
        setError(result.message || 'Your account is already registered and pending admin approval.');
        return;
      }
      setError(result.error || 'Registration failed. Please try again.');
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualRegister = async () => {
    setError('');
    if (!firstname.trim() || !lastname.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const result = await authService.register(
        '',
        firstname.trim(),
        lastname.trim(),
        email.trim().toLowerCase(),
        password,
        confirmPassword,
      );
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIconContainer}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Registration Successful!</Text>
          <Text style={styles.successMessage}>
            Your eLoan account has been created.
          </Text>
          <Text style={styles.successSubMessage}>
            Your account is pending administrator approval. You will be able to
            log in once approved.
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginButtonText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoIcon}>💰</Text>
              <Text style={styles.logoText}>eLoan</Text>
            </View>
            <Text style={styles.title}>Create Account</Text>
          </View>

          {/* Tab Toggle */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, mode === 'google' && styles.tabActive]}
              onPress={() => { setMode('google'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'google' && styles.tabTextActive]}>
                Google
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'manual' && styles.tabActive]}
              onPress={() => { setMode('manual'); setError(''); }}
            >
              <Text style={[styles.tabText, mode === 'manual' && styles.tabTextActive]}>
                Manual
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Google Register */}
          {mode === 'google' && (
            <View>
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>Who can register?</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoBullet}>✓</Text>
                  <Text style={styles.infoText}>
                    BukSU students, faculty, and staff with an{' '}
                    <Text style={styles.infoHighlight}>@buksu.edu.ph</Text> Google account
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoBullet}>ℹ</Text>
                  <Text style={styles.infoText}>
                    Account still requires administrator approval before you can apply for loans
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.googleButton, (loading || !request) && styles.buttonDisabled]}
                onPress={handleGoogleRegister}
                disabled={loading || !request}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#374151" />
                ) : (
                  <>
                    <Text style={styles.googleIcon}>G</Text>
                    <Text style={styles.googleButtonText}>Register with Google</Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.domainHint}>Only @buksu.edu.ph accounts are accepted</Text>
            </View>
          )}

          {/* Manual Register */}
          {mode === 'manual' && (
            <View>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor="#9ca3af"
                value={firstname}
                onChangeText={setFirstname}
                autoCapitalize="words"
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor="#9ca3af"
                value={lastname}
                onChangeText={setLastname}
                autoCapitalize="words"
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Email (@buksu.edu.ph)"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Password (min. 8 characters)"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.registerButton, loading && styles.buttonDisabled]}
                onPress={handleManualRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Login link */}
          <View style={styles.loginLinkContainer}>
            <Text style={styles.loginLinkText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} disabled={loading}>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 24 },
  logoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  logoIcon: { fontSize: 36, marginRight: 8 },
  logoText: { fontSize: 28, fontWeight: 'bold', color: '#1f2937' },
  title: { fontSize: 24, fontWeight: '600', color: '#1f2937' },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 10,
    padding: 3,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#02327a' },
  errorContainer: { backgroundColor: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 16 },
  errorText: { color: '#dc2626', fontSize: 14, lineHeight: 20 },
  infoCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: '#1d4ed8', marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  infoBullet: { fontSize: 14, color: '#1d4ed8', marginRight: 8, marginTop: 1 },
  infoText: { flex: 1, fontSize: 13, color: '#1e40af', lineHeight: 19 },
  infoHighlight: { fontWeight: '700' },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 16,
    marginBottom: 8,
    elevation: 1,
  },
  googleIcon: { fontSize: 18, fontWeight: '700', color: '#4285F4', marginRight: 10 },
  googleButtonText: { color: '#374151', fontSize: 16, fontWeight: '600' },
  domainHint: { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginBottom: 24 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1f2937',
    marginBottom: 12,
  },
  registerButton: {
    backgroundColor: '#02327a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  registerButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  loginLinkContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  loginLinkText: { color: '#6b7280', fontSize: 14 },
  loginLink: { color: '#6366f1', fontSize: 14, fontWeight: '600' },
  // Success screen
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  successIconContainer: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#10b981',
    justifyContent: 'center', alignItems: 'center', marginBottom: 24,
  },
  successIcon: { fontSize: 40, color: '#fff' },
  successTitle: { fontSize: 24, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  successMessage: { fontSize: 15, color: '#6b7280', textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  successSubMessage: { fontSize: 13, color: '#9ca3af', textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  loginButton: { backgroundColor: '#6366f1', borderRadius: 8, paddingVertical: 14, paddingHorizontal: 32 },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});