/**
 * Dashboard Screen
 * Main home screen showing loan stats and recent applications
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import dashboardService from '../services/dashboardService';

// Stats Card Component
const StatsCard = ({ title, value, icon, color = '#17236a' }) => (
  <View style={[styles.statsCard, { borderLeftColor: color }]}>
    <Text style={styles.statsIcon}>{icon}</Text>
    <Text style={styles.statsValue}>{value}</Text>
    <Text style={styles.statsTitle}>{title}</Text>
  </View>
);

// Recent Application Card Component
const ApplicationCard = ({ application, onPress }) => {
  const getStatusColor = (status) => {
    const colors = {
      'Draft': '#9ca3af',
      'Submitted': '#f59e0b',
      'Verified by Bookkeeper': '#3b82f6',
      'Pending Credit Committee': '#8b5cf6',
      'Approved by Credit Committee': '#10b981',
      'Rejected by Bookkeeper': '#ef4444',
      'Rejected by Credit Committee': '#ef4444',
      'Disbursed': '#059669',
      'Paid': '#22c55e',
    };
    return colors[status] || '#6b7280';
  };

  return (
    <TouchableOpacity style={styles.applicationCard} onPress={onPress}>
      <View style={styles.applicationHeader}>
        <Text style={styles.applicationLoanType}>{application.loan_type}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(application.status) }]}>
          <Text style={styles.statusText} numberOfLines={1}>{application.status}</Text>
        </View>
      </View>
      <View style={styles.applicationDetails}>
        <Text style={styles.applicationAmount}>
          ₱{parseFloat(application.amount_requested).toLocaleString()}
        </Text>
        <Text style={styles.applicationDate}>
          {new Date(application.application_date).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

// Eligibility Card Component
const EligibilityCard = ({ canApply, navigation }) => {
  const reason = canApply.reason || '';
  const isActiveLoan = reason.includes('active loan');
  const isSavings = reason.includes('savings');
  const isPending = reason.includes('pending application');
  const isMembership = reason.includes('membership');

  let icon = 'ℹ️';
  let borderColor = '#6b7280';
  let bgColor = '#f9fafb';
  let actionLabel = null;
  let onAction = null;

  if (isSavings) { icon = '💰'; borderColor = '#dc2626'; bgColor = '#fff5f5'; }
  else if (isActiveLoan) { icon = '🔄'; borderColor = '#2563eb'; bgColor = '#eff6ff'; }
  else if (isPending) { icon = '⏳'; borderColor = '#f59e0b'; bgColor = '#fffbeb'; }
  else if (isMembership) { icon = '⚠️'; borderColor = '#dc2626'; bgColor = '#fff5f5'; }

  const savingsInfo = isSavings && canApply.membership_info
    ? `Current savings: ₱${parseFloat(canApply.membership_info.total_savings || 0).toLocaleString()} (minimum required: ₱200.00)`
    : null;

  return (
    <View style={[styles.eligibilityCard, { backgroundColor: bgColor, borderLeftColor: borderColor }]}>
      <Text style={styles.eligibilityIcon}>{icon}</Text>
      <View style={styles.eligibilityContent}>
        <Text style={[styles.eligibilityTitle, { color: borderColor }]}>Why can't I apply?</Text>
        <Text style={styles.eligibilityReason}>{reason}</Text>
        {savingsInfo && <Text style={styles.eligibilityDetail}>{savingsInfo}</Text>}
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} style={[styles.eligibilityActionBtn, { borderColor }]}>
            <Text style={[styles.eligibilityActionText, { color: borderColor }]}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// Notification Preview Card Component
const NotificationCard = ({ notification }) => (
  <View style={styles.notificationCard}>
    <Text style={styles.notificationTitle}>{notification.title}</Text>
    <Text style={styles.notificationMessage} numberOfLines={2}>
      {notification.message}
    </Text>
    <Text style={styles.notificationTime}>
      {new Date(notification.created_at).toLocaleDateString()}
    </Text>
  </View>
);

export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);
  const [recentApplications, setRecentApplications] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [canApply, setCanApply] = useState({ can_apply: false, reason: '' });

  const loadDashboard = useCallback(async () => {
    try {
      const [dashboardData, canApplyResult] = await Promise.all([
        dashboardService.getDashboard(),
        dashboardService.checkCanApply(),
      ]);

      setStats(dashboardData.stats);
      setRecentApplications(dashboardData.recent_applications || []);
      setNotifications(dashboardData.notifications || []);
      setCanApply(canApplyResult);
    } catch (error) {
      console.error('Dashboard load error:', error);
      if (error.response?.status === 401) {
        // Token expired, logout
        await logout();
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  const handleApplyPress = () => {
    if (canApply.can_apply) {
      navigation.navigate('ApplicationWizard');
      return;
    }

    const hasEditableApplication = recentApplications.some((app) =>
      ['Draft', 'Submitted'].includes(app.status)
    );

    if (hasEditableApplication) {
      navigation.navigate('ApplicationWizard');
      return;
    }

    if (canApply.needs_profile_update) {
      navigation.navigate('Profile');
      return;
    }
    // Eligibility card below the button handles the messaging — no alert needed
  };

  const handleApplicationPress = (application) => {
    navigation.navigate('ApplicationDetail', { id: application.id });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#17236a" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#17236a']} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.firstname || 'Applicant'}</Text>
          </View>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>💰</Text>
            <Text style={styles.logoText}>eLoan</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatsCard
            title="Total Apps"
            value={stats?.total_applications || 0}
            icon="📋"
            color="#17236a"
          />
          <StatsCard
            title="Active Loans"
            value={stats?.approved_loans || 0}
            icon="✅"
            color="#10b981"
          />
          <StatsCard
            title="Pending"
            value={stats?.pending_applications || 0}
            icon="⏳"
            color="#f59e0b"
          />
          <StatsCard
            title="Total Paid"
            value={`₱${parseFloat(stats?.total_paid || 0).toLocaleString()}`}
            icon="💰"
            color="#059669"
          />
        </View>

        {/* Apply Button */}
        <TouchableOpacity
          style={[
            styles.applyButton,
            !canApply.can_apply && styles.applyButtonDisabled,
          ]}
          onPress={handleApplyPress}
        >
          <Text style={styles.applyButtonText}>
            {canApply.can_apply ? '+ Apply for a Loan' : 'Loan Application Unavailable'}
          </Text>
        </TouchableOpacity>

        {/* Profile Update Banner */}
        {!canApply.can_apply && canApply.needs_profile_update && (
          <View style={styles.profileUpdateBanner}>
            <Text style={styles.profileUpdateTitle}>Profile Update Required</Text>
            <Text style={styles.profileUpdateText}>
              Your profile was last updated {canApply.months_since_update} month(s) ago.
              Please update your information to apply for loans.
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.profileUpdateButton}>
              <Text style={styles.profileUpdateButtonText}>Update Profile Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Eligibility Card */}
        {!canApply.can_apply && !canApply.needs_profile_update && (
          <EligibilityCard canApply={canApply} navigation={navigation} />
        )}

        {/* Recent Applications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Applications</Text>
            {recentApplications.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('MyApplications')}>
                <Text style={styles.seeAllLink}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentApplications.length > 0 ? (
            recentApplications.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onPress={() => handleApplicationPress(app)}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📄</Text>
              <Text style={styles.emptyStateText}>No applications yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Start your first loan application today!
              </Text>
            </View>
          )}
        </View>

        {/* Notifications Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Notifications</Text>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
                <Text style={styles.seeAllLink}>See All</Text>
              </TouchableOpacity>
            )}
          </View>
          {notifications.length > 0 ? (
            notifications.slice(0, 3).map((notif) => (
              <NotificationCard key={notif.id} notification={notif} />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🔔</Text>
              <Text style={styles.emptyStateText}>No notifications</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: '#6b7280',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 24,
    marginRight: 4,
  },
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#17236a',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statsCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statsIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  statsTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  applyButton: {
    backgroundColor: '#17236a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#17236a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowColor: '#9ca3af',
  },
  applyButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  seeAllLink: {
    color: '#17236a',
    fontSize: 14,
    fontWeight: '500',
  },
  applicationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  applicationLoanType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: 140,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },
  applicationDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  applicationAmount: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  applicationDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  notificationCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#17236a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  // Profile update banner
  profileUpdateBanner: {
    backgroundColor: '#fffbeb',
    borderLeftWidth: 4,
    borderLeftColor: '#d97706',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  profileUpdateTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  profileUpdateText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 18,
    marginBottom: 10,
  },
  profileUpdateButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#d97706',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  profileUpdateButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  // Eligibility card
  eligibilityCard: {
    flexDirection: 'row',
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  eligibilityIcon: {
    fontSize: 22,
    marginRight: 12,
    marginTop: 2,
  },
  eligibilityContent: {
    flex: 1,
  },
  eligibilityTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  eligibilityReason: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  eligibilityDetail: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
  },
  eligibilityActionBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  eligibilityActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
