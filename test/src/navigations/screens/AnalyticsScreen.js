import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen({ navigation, route }) {
  const { name = 'User', id = 'N/A' } = route.params || {};

  return (
    <View style={styles.container}>

      {/* eLoan Logo */}
      <Image
        source={require('../../../assets/EloanLogo.png')}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>Analytics</Text>

      {/* Scrollable Content */}
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={true}>

        {/* Analytics Cards */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Loans</Text>
          <Text style={styles.cardValue}>5</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Active Loans</Text>
          <Text style={styles.cardValue}>2</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Total Borrowed</Text>
          <Text style={styles.cardValue}>₱250,000</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Outstanding Balance</Text>
          <Text style={styles.cardValue}>₱150,000</Text>
        </View>

      </ScrollView>

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
    paddingBottom: 70,
    paddingTop: 0,
  },
  logo: {
    width: width * 1.1,
    height: width * 0.65,
    alignSelf: 'center',
    marginBottom: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#FFFFFF',
    marginBottom: 0,
  },
  scrollContent: {
    flex: 1,
    paddingBottom: 20,
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: '#1E293B',
    margin: 10,
    padding: 15,
    borderRadius: 10,
  },
  cardTitle: {
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#60A5FA',
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
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    gap: 5,
  },
  navText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '600',
  },
});
