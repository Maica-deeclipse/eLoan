import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
} from 'react-native';
import { useState } from 'react';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    Alert.alert('Success', 'You have successfully logged in!', [
      {
        text: 'Continue',
        onPress: () => navigation.navigate('Home', { name: email }),
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

      <Text style={styles.title}>Login</Text>

      <TextInput
        placeholder="Email / Username"
        placeholderTextColor="#CBD5E1"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        placeholder="Password"
        placeholderTextColor="#CBD5E1"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>

      <Text
        style={styles.link}
        onPress={() => navigation.navigate('Signup')}
      >
        Don’t have an account? Sign Up
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1F3A',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: width * 1.1,   // 110% of screen width
    height: width * 0.65, // proportional height
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
    backgroundColor: '#16A34A',
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
