/**
 * Main Tab Navigator
 * Bottom tab navigation — Modern fintech navy theme
 */

import { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Screens
import DashboardScreen       from '../screens/DashboardScreen';
import MyApplicationsScreen  from '../screens/MyApplicationsScreen';
import NotificationsScreen   from '../screens/NotificationsScreen';
import ProfileScreen         from '../screens/ProfileScreen';

// Services
import notificationService from '../services/notificationService';
import logger from '../utils/logger';

const Tab = createBottomTabNavigator();

// ── Design Tokens ──────────────────────────────────────────────────────────────
const NAVY  = '#0f1c52';
const WHITE = '#FFFFFF';
const MUTED = '#94A3B8';

// ── Tab Icon Component ─────────────────────────────────────────────────────────
const ICONS = {
  home:          require('../../assets/house.png'),
  applications:  require('../../assets/loans.png'),
  notifications: require('../../assets/alerts.png'),
  settings:      require('../../assets/settings.png'),
};

const TabIcon = ({ name, focused }) => (
  <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
    <Image
      source={ICONS[name]}
      style={[styles.iconImg, { opacity: focused ? 1 : 0.45 }]}
      resizeMode="contain"
    />
  </View>
);

// ── Apply Placeholder ──────────────────────────────────────────────────────────
const ApplyPlaceholder = () => null;

// ── Navigator ─────────────────────────────────────────────────────────────────
export default function MainTabNavigator({ navigation }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 120000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      logger.error('Error loading unread count:', error);
    }
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: NAVY,
        tabBarInactiveTintColor: MUTED,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} />,
        }}
      />

      <Tab.Screen
        name="MyApplications"
        component={MyApplicationsScreen}
        options={{
          tabBarLabel: 'My Loans',
          tabBarIcon: ({ focused }) => <TabIcon name="applications" focused={focused} />,
        }}
      />

      {/* ── Floating Action Button ── */}
      <Tab.Screen
        name="Apply"
        component={ApplyPlaceholder}
        options={{
          tabBarLabel: '',
          tabBarIcon: () => (
            <View style={styles.fabOuter}>
              <View style={styles.fab}>
                <Text style={styles.fabIcon}>+</Text>
              </View>
            </View>
          ),
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('ApplicationWizard');
          },
        }}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ focused }) => <TabIcon name="notifications" focused={focused} />,
          tabBarBadge: unreadCount > 0 ? unreadCount : null,
          tabBarBadgeStyle: styles.badge,
        }}
      />

      <Tab.Screen
        name="Settings"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: WHITE,
    borderTopWidth: 0,
    height: 72,
    paddingBottom: 10,
    paddingTop: 8,
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 16,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.2,
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  iconWrapActive: {
    backgroundColor: NAVY + '12',
  },
  iconImg: {
    width: 22,
    height: 22,
    tintColor: NAVY,
  },

  // ── FAB ──
  fabOuter: {
    position: 'absolute',
    top: -24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NAVY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 3,
    borderColor: WHITE,
  },
  fabIcon: {
    fontSize: 32,
    color: WHITE,
    fontFamily: 'Poppins_300Light',
    lineHeight: 36,
    includeFontPadding: false,
  },

  badge: {
    backgroundColor: '#EF4444',
    fontSize: 10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
  },
});
