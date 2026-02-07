import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
} from 'react-native';
import { useState } from 'react';

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleSignup = () => {
    if (!name || !id || !password || !confirm) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    Alert.alert('Success', 'Account created successfully!', [
      {
        text: 'Continue',
        onPress: () => navigation.navigate('Home', { name, id }),
      },
    ]);
  };

  return (
    <View style={styles.container}>

      {/* eLoan Logo */}
      <Image
        source={require('../../../assets/EloanLogo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>Sign Up</Text>

      <TextInput
        placeholder="Full Name"
        placeholderTextColor="#CBD5E1"
        style={styles.input}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Employee / Student ID"
        placeholderTextColor="#CBD5E1"
        style={styles.input}
        onChangeText={setId}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#CBD5E1"
        secureTextEntry
        style={styles.input}
        onChangeText={setPassword}
      />

      <TextInput
        placeholder="Confirm Password"
        placeholderTextColor="#CBD5E1"
        secureTextEntry
        style={styles.input}
        onChangeText={setConfirm}
      />

      <TouchableOpacity style={styles.button} onPress={handleSignup}>
        <Text style={styles.buttonText}>Create Account</Text>
      </TouchableOpacity>

      <Text
        style={styles.link}
        onPress={() => navigation.navigate('Login')}
      >
        Already have an account? Login
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1F3A', // Dark Navy Blue
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 240,
    height: 90,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 10,
    marginTop: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    marginTop: 15,
    textAlign: 'center',
    color: '#60A5FA',
  },
});
