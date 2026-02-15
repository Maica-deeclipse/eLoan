import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
  return (
    <View style={styles.container}>

      {/* Fixed header: logo + title */}
      <Image
        source={require('../../../assets/EloanLogo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.headerTitle}>Profile</Text>

      {/* Scrollable profile cards only */}
      <ScrollView style={styles.cardsScroll} contentContainerStyle={styles.cardsContent} showsVerticalScrollIndicator={true}>

        {/* Primary profile (existing) */}
        <View style={styles.card}>
          <Image
            source={require('../../../assets/profile.jpg')}
            style={styles.profilePicture}
          />
          <Text style={styles.name}>Marc Ian C. Plazos</Text>
          <Text style={styles.info}>ID: 2023-00123</Text>
          <Text style={styles.info}>Email: marcian@email.com</Text>
          <Text style={styles.info}>Department: IT</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.buttonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Generated profiles */}
        <View style={styles.card}>
          <Image
            source={require('../../../assets/cordero_profile.jpg')}
            style={styles.profilePicture}
          />
          <Text style={styles.name}>Abegail B. Cordero</Text>
          <Text style={styles.info}>ID: 2026-10001</Text>
          <Text style={styles.info}>Email: abegail.cordero@example.com</Text>
          <Text style={styles.info}>Department: IT</Text>
        </View>

        <View style={styles.card}>
          <Image
            source={require('../../../assets/silvano_profile.png')}
            style={styles.profilePicture}
          />
          <Text style={styles.name}>Jemaica Silvano S. Silvano</Text>
          <Text style={styles.info}>ID: 2026-10002</Text>
          <Text style={styles.info}>Email: jemaica.silvano@example.com</Text>
          <Text style={styles.info}>Department: IT</Text>
        </View>

        <View style={styles.card}>
          <Image
            source={require('../../../assets/salingoran_profile.jpg')}
            style={styles.profilePicture}
          />
          <Text style={styles.name}>Chinn Demple S. Salingoran</Text>
          <Text style={styles.info}>ID: 2026-10003</Text>
          <Text style={styles.info}>Email: chinn.salingoran@example.com</Text>
          <Text style={styles.info}>Department: IT</Text>
        </View>

      </ScrollView>
      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <Ionicons name="home" size={24} color="#60A5FA" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Analytics')}>
          <Ionicons name="bar-chart" size={24} color="#60A5FA" />
          <Text style={styles.navText}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
          <Ionicons name="person" size={24} color="#60A5FA" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Settings')}>
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 70,
  },
  logo: {
    width: width * 0.9,
    height: width * 0.5,
    marginTop: 0,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: -6,
    marginBottom: 12,
  },

  cardsScroll: {
    width: '100%',
    flex: 1,
  },

  cardsContent: {
    paddingBottom: 110,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  card: {
    backgroundColor: '#1E293B',
    width: '100%',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginVertical: 8,
  },
  profilePicture: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 15,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 15,
    textAlign: 'center',
  },
  info: {
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 8,
  },
  button: {
    marginTop: 20,
    backgroundColor: '#2563EB',
    padding: 14,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
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
