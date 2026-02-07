import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation, route }) {
  const { name = 'User', id = 'N/A' } = route.params || {};

  return (
    <View style={styles.container}>

      {/* eLoan Logo */}
      <Image
        source={require('../../../assets/EloanLogo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>Welcome, {name}!</Text>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home', { name, id })}>
          <Ionicons name="home" size={24} color="#60A5FA" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Analytics', { name, id })}>
          <Ionicons name="bar-chart" size={24} color="#60A5FA" />
          <Text style={styles.navText}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile', { name, id })}>
          <Ionicons name="person" size={24} color="#60A5FA" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Settings', { name, id })}>
          <Ionicons name="settings" size={24} color="#60A5FA" />
          <Text style={styles.navText}>Settings</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1F3A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logo: {
    width: width * 1.1,
    height: width * 0.65,
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 10,
    width: '75%',
    marginBottom: 15,
  },
  logout: {
    backgroundColor: '#DC2626',
    padding: 15,
    borderRadius: 10,
    width: '75%',
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingVertical: 15,
  },
    gap: 5,
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  navText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '600',
  },
});
