/**
 * Dashboard Screen
 * Fixed header + contained swipeable pager (4 slides)
 * Slide 1: new Loan Portfolio card design
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Image,
  StatusBar,
  Dimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import dashboardService from '../services/dashboardService';
import logger from '../utils/logger';

const { width: W, height: H } = Dimensions.get('window');

// ── Design Tokens ──────────────────────────────────────────────────────────────
const PRIMARY   = '#0f1c52';
const GRAD      = '#17235a';
const ACCENT    = '#4D80E4';
const WHITE     = '#FFFFFF';
const PAGE_BG   = '#EEF4FF';
const CARD_BG   = '#F4F7FF';
const SUCCESS   = '#10B981';
const WARN      = '#F59E0B';
const PURPLE    = '#7C3AED';
const MUTED     = '#94A3B8';
const SECONDARY = '#64748B';

const PAGER_SIDE_MARGIN = 16;
const PAGER_W = W - PAGER_SIDE_MARGIN * 2;
const PAGER_H = Math.min(490, Math.round(H * 0.58));

// ── Pagination Dots ────────────────────────────────────────────────────────────
const PaginationDots = ({ count, scrollX }) => (
  <View style={styles.dotsRow}>
    {Array.from({ length: count }).map((_, i) => {
      const dotWidth = scrollX.interpolate({
        inputRange: [(i - 1) * PAGER_W, i * PAGER_W, (i + 1) * PAGER_W],
        outputRange: [7, 22, 7],
        extrapolate: 'clamp',
      });
      const dotOpacity = scrollX.interpolate({
        inputRange: [(i - 1) * PAGER_W, i * PAGER_W, (i + 1) * PAGER_W],
        outputRange: [0.3, 1, 0.3],
        extrapolate: 'clamp',
      });
      return (
        <Animated.View
          key={i}
          style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
        />
      );
    })}
  </View>
);

// ── Application Card ───────────────────────────────────────────────────────────
const ApplicationCard = ({ application, onPress }) => {
  const STATUS_COLORS = {
    'Draft':                          '#94A3B8',
    'Submitted':                      '#F59E0B',
    'Verified by Bookkeeper':         '#3B82F6',
    'Pending Credit Committee':       '#8B5CF6',
    'Approved by Credit Committee':   '#10B981',
    'Rejected by Bookkeeper':         '#EF4444',
    'Rejected by Credit Committee':   '#EF4444',
    'Disbursed':                      '#059669',
    'Paid':                           '#22C55E',
  };
  const color = STATUS_COLORS[application.status] || '#6B7280';
  return (
    <TouchableOpacity style={styles.appCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.appStripe, { backgroundColor: color }]} />
      <View style={styles.appBody}>
        <View style={styles.appRow}>
          <Text style={styles.appType} numberOfLines={1}>{application.loan_type}</Text>
          <View style={[styles.statusPill, { backgroundColor: color + '22', borderColor: color }]}>
            <Text style={[styles.statusText, { color }]} numberOfLines={1}>{application.status}</Text>
          </View>
        </View>
        <View style={styles.appRow}>
          <Text style={styles.appAmount}>
            ₱{parseFloat(application.amount_requested).toLocaleString()}
          </Text>
          <Text style={styles.appDate}>
            {new Date(application.application_date).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Notification Card ──────────────────────────────────────────────────────────
const NotificationCard = ({ notification }) => (
  <View style={styles.notifCard}>
    <View style={styles.notifDot} />
    <View style={styles.notifContent}>
      <Text style={styles.notifTitle}>{notification.title}</Text>
      <Text style={styles.notifMsg} numberOfLines={2}>{notification.message}</Text>
      <Text style={styles.notifTime}>
        {new Date(notification.created_at).toLocaleDateString()}
      </Text>
    </View>
  </View>
);

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats]           = useState(null);
  const [recentApps, setRecentApps] = useState([]);
  const [notifications, setNotifs]  = useState([]);
  const [canApply, setCanApply]     = useState({ can_apply: false, reason: '' });
  const scrollX = useRef(new Animated.Value(0)).current;

  const loadDashboard = useCallback(async () => {
    try {
      const [dashData, canApplyRes] = await Promise.all([
        dashboardService.getDashboard(),
        dashboardService.checkCanApply(),
      ]);
      setStats(dashData.stats);
      setRecentApps(dashData.recent_applications || []);
      setNotifs(dashData.notifications || []);
      setCanApply(canApplyRes);
    } catch (err) {
      logger.error('Dashboard error:', err);
      if (err.response?.status === 401) await logout();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logout]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  const handleApplyPress = () => {
    if (canApply.can_apply) { navigation.navigate('ApplicationWizard'); return; }
    const hasEditable = recentApps.some(a => ['Draft', 'Submitted'].includes(a.status));
    if (hasEditable) { navigation.navigate('ApplicationWizard'); return; }
    Alert.alert('Cannot Apply', canApply.reason);
  };

  const getSlideStyle = useCallback((index) => {
    const inputRange = [(index - 1) * PAGER_W, index * PAGER_W, (index + 1) * PAGER_W];
    return {
      opacity: scrollX.interpolate({ inputRange, outputRange: [0.65, 1, 0.65], extrapolate: 'clamp' }),
      transform: [{
        scale: scrollX.interpolate({ inputRange, outputRange: [0.94, 1, 0.94], extrapolate: 'clamp' }),
      }],
    };
  }, [scrollX]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading your dashboard…</Text>
      </SafeAreaView>
    );
  }

  const displayName =
    [user?.firstname, user?.lastname].filter(Boolean).join(' ') || 'Applicant';

  const activeLoans  = stats?.approved_loans        ?? 0;
  const pending      = stats?.pending_applications  ?? 0;
  const totalPaid    = parseFloat(stats?.total_paid || 0);
  const totalBalance = parseFloat(stats?.total_balance || stats?.total_outstanding_balance || 0);
  const paidPct      = totalPaid > 0 ? Math.min((totalPaid / 50000) * 100, 100) : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* ── Fixed Header ── */}
      <View style={styles.header}>
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greetSub}>Welcome!</Text>
            <Text style={styles.greetName}>{displayName}</Text>
          </View>
          <View style={styles.logoBubble}>
            <Image
              source={require('../../assets/logoblue.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>

      {/* ── Swipeable Pager ── */}
      <View style={styles.pagerBox}>
        <Animated.ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          style={styles.pagerScroll}
        >

          {/* ══════════════════════════════════════════
              SLIDE 1 — Loan Portfolio Overview
          ══════════════════════════════════════════ */}
          <Animated.View style={[styles.page, getSlideStyle(0)]}>
            <ScrollView
              contentContainerStyle={styles.pageContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[PRIMARY]}
                  tintColor={PRIMARY}
                />
              }
            >
              <Text style={styles.pageLabel}>Overview</Text>

              {/* ── Loan Portfolio Card ── */}
              <View style={styles.portfolioCard}>
                <View style={styles.portfolioCardOverlay} />

                {/* Card header row */}
                <View style={styles.portfolioHeaderRow}>
                  <Text style={styles.portfolioTitle}>Loan Summary</Text>
            
            
                 
                </View>

                {/* Total balance */}
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceAmount}>
                    ₱{totalBalance.toLocaleString()}
                  </Text>
                  <Text style={styles.balanceLabel}>  Total Balance</Text>
                </View>

                {/* 3 stat boxes */}
                <View style={styles.statBoxesRow}>
                  <View style={[styles.statBox, styles.statBoxRight]}>
                    <Text style={styles.statBoxIcon}>💼</Text>
                    <Text style={styles.statBoxLabel}>Active</Text>
                    <Text style={[styles.statBoxValue, { color: SUCCESS }]}>{activeLoans}</Text>
                  </View>
                  <View style={[styles.statBox, styles.statBoxRight]}>
                    <Text style={styles.statBoxIcon}>⏳</Text>
                    <Text style={styles.statBoxLabel}>Pending</Text>
                    <Text style={[styles.statBoxValue, { color: WARN }]}>{pending}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statBoxIcon}>✅</Text>
                    <Text style={styles.statBoxLabel}>Paid</Text>
                    <Text style={[styles.statBoxValue, { color: PURPLE }]}>
                      ₱{totalPaid.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Total Paid progress */}
                <View style={styles.paidRow}>
                  <View style={styles.paidLeft}>
                    <View style={[styles.paidDot, { backgroundColor: PURPLE }]} />
                    <Text style={styles.paidLabel}>Total Paid</Text>
                  </View>
                  <Text style={[styles.paidValue, { color: PURPLE }]}>
                    ₱{totalPaid.toLocaleString()}
                  </Text>
                </View>
                <View style={styles.paidTrack}>
                  <View
                    style={[
                      styles.paidFill,
                      { width: `${Math.max(paidPct, 5)}%`, backgroundColor: PURPLE },
                    ]}
                  />
                </View>
              </View>

            </ScrollView>
          </Animated.View>

          {/* ══════════════════════════════════════════
              SLIDE 2 — Loan Eligibility
          ══════════════════════════════════════════ */}
          <Animated.View style={[styles.page, styles.pageCentered, getSlideStyle(1)]}>
            <Text style={styles.pageLabel}>Loan Eligibility</Text>
            <TouchableOpacity
              style={[
                styles.eligCard,
                canApply.can_apply ? styles.eligGreen : styles.eligAmber,
              ]}
              onPress={handleApplyPress}
              activeOpacity={0.88}
            >
              <View style={styles.eligGifWrap}>
                <Image
                  source={require('../../assets/cannot_apply.gif')}
                  style={styles.eligGif}
                  resizeMode="contain"
                />
              </View>
              <Text
                style={[
                  styles.eligTitle,
                  { color: canApply.can_apply ? '#065F46' : '#92400E' },
                ]}
              >
                {canApply.can_apply ? 'You Are Eligible!' : 'Cannot Apply'}
              </Text>
              <Text
                style={[
                  styles.eligBody,
                  { color: canApply.can_apply ? '#047857' : '#B45309' },
                ]}
              >
                {canApply.can_apply
                  ? 'Tap to start your loan application.'
                  : canApply.reason ||
                    'Minimum savings of PHP 200 required.\nYour current savings: PHP 0.00'}
              </Text>
              <View
                style={[
                  styles.eligBtn,
                  canApply.can_apply
                    ? { backgroundColor: SUCCESS + '25', borderColor: SUCCESS }
                    : { backgroundColor: WARN + '25', borderColor: WARN },
                ]}
              >
                <Text
                  style={[
                    styles.eligBtnText,
                    { color: canApply.can_apply ? '#065F46' : '#92400E' },
                  ]}
                >
                  {canApply.can_apply ? 'Apply Now →' : 'View Requirements'}
                </Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ══════════════════════════════════════════
              SLIDE 3 — Recent Applications
          ══════════════════════════════════════════ */}
          <Animated.View style={[styles.page, getSlideStyle(2)]}>
            <View style={styles.pageLabelRow}>
              <Text style={styles.pageLabel}>Recent Applications</Text>
              {recentApps.length > 0 && (
                <TouchableOpacity onPress={() => navigation.navigate('MyApplications')}>
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              style={styles.pageScroll}
              contentContainerStyle={
                recentApps.length === 0 ? styles.pageCenteredContent : undefined
              }
            >
              {recentApps.length > 0 ? (
                recentApps.map(app => (
                  <ApplicationCard
                    key={app.id}
                    application={app}
                    onPress={() =>
                      navigation.navigate('ApplicationDetail', { id: app.id })
                    }
                  />
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Image
                    source={require('../../assets/no_applications_yet.gif')}
                    style={styles.emptyGif}
                    resizeMode="contain"
                  />
                  <Text style={styles.emptyTitle}>No loans yet</Text>
                  <Text style={styles.emptySub}>
                    Start your journey by applying for a loan
                  </Text>
                  <TouchableOpacity
                    style={styles.applyBtn}
                    onPress={handleApplyPress}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.applyBtnText}>+ Apply Now</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </Animated.View>

          {/* ══════════════════════════════════════════
              SLIDE 4 — Recent Notifications
          ══════════════════════════════════════════ */}
          <Animated.View style={[styles.page, getSlideStyle(3)]}>
            <View style={styles.pageLabelRow}>
              <Text style={styles.pageLabel}>Recent Notifications</Text>
              {notifications.length > 0 && (
                <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
                  <Text style={styles.seeAll}>See All</Text>
                </TouchableOpacity>
              )}
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              style={styles.pageScroll}
              contentContainerStyle={
                notifications.length === 0 ? styles.pageCenteredContent : undefined
              }
            >
              {notifications.length > 0 ? (
                notifications
                  .slice(0, 3)
                  .map(n => <NotificationCard key={n.id} notification={n} />)
              ) : (
                <View style={styles.emptyState}>
                  <Image
                    source={require('../../assets/notification.gif')}
                    style={styles.emptyGif}
                    resizeMode="contain"
                  />
                  <Text style={styles.emptyTitle}>No notifications</Text>
                  <Text style={styles.emptySub}>You're all caught up.</Text>
                </View>
              )}
            </ScrollView>
          </Animated.View>

        </Animated.ScrollView>

        <PaginationDots count={4} scrollX={scrollX} />
      </View>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  screen:        { flex: 1, backgroundColor: PAGE_BG },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAGE_BG },
  loadingText:   { marginTop: 12, fontSize: 15, color: SECONDARY },

  // ── Header ──
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GRAD,
    opacity: 0.55,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetSub:   { fontSize: 13, color: 'rgba(255,255,255,0.65)', letterSpacing: 0.4 },
  greetName:  { fontSize: 22, fontFamily: 'Poppins_700Bold', color: WHITE, marginTop: 2 },
  logoBubble: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  logoImg: { width: 80, height: 80 },

  // ── Pager Container ──
  pagerBox: {
    marginHorizontal: PAGER_SIDE_MARGIN,
    marginTop: 14,
    height: PAGER_H,
    backgroundColor: WHITE,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  pagerScroll: { flex: 1 },

  // ── Slide Page ──
  page: {
    width: PAGER_W,
    flex: 1,
    backgroundColor: WHITE,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  pageContent:         { paddingBottom: 10 },
  pageCentered:        { justifyContent: 'center' },
  pageCenteredContent: { flexGrow: 1, justifyContent: 'center' },
  pageScroll:          { flex: 1 },
  pageLabel: {
    fontSize: 11,
    fontFamily: 'Poppins_800ExtraBold',
    color: PRIMARY,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.6,
    marginBottom: 10,
  },
  pageLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  seeAll: { fontSize: 13, color: ACCENT, fontFamily: 'Poppins_600SemiBold' },

  // ── Loan Portfolio Card (Slide 1) ──
  portfolioCard: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  portfolioCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GRAD,
    opacity: 0.5,
  },
  portfolioHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  portfolioTitle: { fontSize: 14, fontFamily: 'Poppins_700Bold', color: WHITE },
  portfolioIconBubble: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  portfolioIcon: { fontSize: 16 },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  balanceAmount: {
    fontSize: 32,
    fontFamily: 'Poppins_800ExtraBold',
    color: WHITE,
    letterSpacing: -1,
  },
  balanceLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'Poppins_500Medium',
  },

  statBoxesRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
  },
  statBox: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  statBoxRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.2)',
  },
  statBoxIcon:  { fontSize: 16, marginBottom: 3 },
  statBoxLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'Poppins_600SemiBold',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statBoxValue: { fontSize: 12, fontFamily: 'Poppins_800ExtraBold' },

  paidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },
  paidLeft:  { flexDirection: 'row', alignItems: 'center' },
  paidDot:   { width: 7, height: 7, borderRadius: 3.5, marginRight: 6 },
  paidLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: 'Poppins_500Medium' },
  paidValue: { fontSize: 12, fontFamily: 'Poppins_700Bold' },
  paidTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  paidFill: { height: '100%', borderRadius: 3 },

  // ── Eligibility Card ──
  eligCard: {
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
  },
  eligAmber:   { backgroundColor: WHITE, borderColor: 'rgba(15,28,82,0.08)' },
  eligGreen:   { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7' },
  eligGifWrap: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: WHITE,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  eligGif:     { width: 88, height: 88 },
  eligTitle:   { fontSize: 17, fontFamily: 'Poppins_700Bold', textAlign: 'center', marginBottom: 7 },
  eligBody:    { fontSize: 12, textAlign: 'center', lineHeight: 19, marginBottom: 16 },
  eligBtn: {
    paddingHorizontal: 22, paddingVertical: 9,
    borderRadius: 18, borderWidth: 1.5,
  },
  eligBtnText: { fontSize: 13, fontFamily: 'Poppins_600SemiBold' },

  // ── App Card ──
  appCard: {
    backgroundColor: CARD_BG, borderRadius: 12, marginBottom: 9,
    flexDirection: 'row', overflow: 'hidden',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 5, elevation: 2,
  },
  appStripe: { width: 4 },
  appBody:   { flex: 1, padding: 12 },
  appRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  appType:   { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: PRIMARY, flex: 1, marginRight: 6 },
  statusPill:{ borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, maxWidth: 120 },
  statusText:{ fontSize: 9, fontFamily: 'Poppins_600SemiBold' },
  appAmount: { fontSize: 13, color: SECONDARY, fontFamily: 'Poppins_500Medium' },
  appDate:   { fontSize: 11, color: MUTED },

  // ── Notif Card ──
  notifCard: {
    backgroundColor: CARD_BG, borderRadius: 12, marginBottom: 9,
    flexDirection: 'row', alignItems: 'flex-start', padding: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  notifDot:     { width: 7, height: 7, borderRadius: 3.5, backgroundColor: ACCENT, marginTop: 4, marginRight: 10, flexShrink: 0 },
  notifContent: { flex: 1 },
  notifTitle:   { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: PRIMARY, marginBottom: 2 },
  notifMsg:     { fontSize: 12, color: SECONDARY, lineHeight: 17 },
  notifTime:    { fontSize: 10, color: MUTED, marginTop: 4 },

  // ── Empty State ──
  emptyState:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
  emptyGif:    { width: 100, height: 100, marginBottom: 10 },
  emptyTitle:  { fontSize: 16, fontFamily: 'Poppins_700Bold', color: PRIMARY, marginBottom: 6 },
  emptySub:    { fontSize: 12, color: MUTED, textAlign: 'center', lineHeight: 18, marginBottom: 18 },
  applyBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  applyBtnText: { color: WHITE, fontSize: 14, fontFamily: 'Poppins_700Bold' },

  // ── Pagination Dots ──
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 10, backgroundColor: WHITE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,28,82,0.08)',
  },
  dot: { height: 7, borderRadius: 3.5, backgroundColor: PRIMARY, marginHorizontal: 4 },
});
