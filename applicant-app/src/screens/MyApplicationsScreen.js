/**
 * My Applications Screen
 * Shows all loan applications for the user
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';

const { width: W } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import applicationService from '../services/applicationService';
import { clearLoanTypeDraft } from '../utils/applicationDraftStorage';

// ── Design Tokens ──────────────────────────────────────────────────────────────
const PRIMARY   = '#0f1c52';
const GRAD      = '#17235a';
const ACCENT    = '#4D80E4';
const WHITE     = '#FFFFFF';
const PAGE_BG   = '#EEF4FF';
const CARD_BG   = '#F4F7FF';
const SUCCESS   = '#10B981';
const WARN      = '#F59E0B';
const MUTED     = '#94A3B8';
const SECONDARY = '#64748B';

const CARD_W      = W - 56;
const CARD_MARGIN = 10;

// ── Read-Only Loan Type Card (for Available Loans tab) ─────────────────────────
const LoanTypeCard = ({ loanType, index, total }) => (
  <View style={ltCard.card}>
    <View style={ltCard.cardStrip} />
    <View style={ltCard.cardCountRow}>
      <Text style={ltCard.cardCount}>{index + 1} / {total}</Text>
    </View>
    <Text style={ltCard.loanName}>{loanType.loan_name}</Text>
    <Text style={ltCard.loanDescription}>{loanType.description || 'Standard loan product'}</Text>
    {loanType.required_comakers > 0 && (
      <View style={ltCard.comakerBadge}>
        <Text style={ltCard.comakerText}>
          👥 {loanType.required_comakers} Co-maker{loanType.required_comakers > 1 ? 's' : ''} required
        </Text>
      </View>
    )}
    <View style={ltCard.cardDivider} />
    <View style={ltCard.detailsGrid}>
      <View style={ltCard.detailBox}>
        <Text style={ltCard.detailLabel}>Min Amount</Text>
        <Text style={[ltCard.detailValue, { color: SUCCESS }]}>
          ₱{parseFloat(loanType.min_amount).toLocaleString()}
        </Text>
      </View>
      <View style={ltCard.detailBox}>
        <Text style={ltCard.detailLabel}>Max Amount</Text>
        <Text style={[ltCard.detailValue, { color: PRIMARY }]}>
          ₱{parseFloat(loanType.max_amount).toLocaleString()}
        </Text>
      </View>
      <View style={ltCard.detailBox}>
        <Text style={ltCard.detailLabel}>Interest Rate</Text>
        <Text style={[ltCard.detailValue, { color: WARN }]}>
          {loanType.interest_rate}% p.a.
        </Text>
      </View>
      <View style={ltCard.detailBox}>
        <Text style={ltCard.detailLabel}>Max Term</Text>
        <Text style={[ltCard.detailValue, { color: ACCENT }]}>
          {loanType.max_term_months} months
        </Text>
      </View>
    </View>
  </View>
);

const getStatusColor = (status) => {
  const colors = {
    'Draft':                          '#9ca3af',
    'Submitted':                      '#f59e0b',
    'Verified by Bookkeeper':         '#3b82f6',
    'Pending Credit Committee':       '#8b5cf6',
    'Approved by Credit Committee':   '#10b981',
    'Rejected by Bookkeeper':         '#ef4444',
    'Rejected by Credit Committee':   '#ef4444',
    'Active':                         '#059669',
    'Disbursed':                      '#059669',
    'Paid':                           '#22c55e',
    'Withdrawn':                      '#6b7280',
  };
  return colors[status] || '#6b7280';
};

// ── Application Card ───────────────────────────────────────────────────────────
const ApplicationItem = ({ application, onPress, onResume, onDeleteDraft }) => {
  const statusColor = getStatusColor(application.status);
  return (
    <TouchableOpacity style={styles.applicationCard} onPress={onPress} activeOpacity={0.8}>
      {/* left color stripe */}
      <View style={[styles.cardStripe, { backgroundColor: statusColor }]} />

      <View style={styles.cardInner}>
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.loanType}>{application.loan_type}</Text>
            <Text style={styles.applicationId}>Application #{application.user_application_number ?? application.id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
              {application.status}
            </Text>
          </View>
        </View>

        {/* Detail rows */}
        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.detailValue}>
              ₱{parseFloat(application.amount_requested).toLocaleString()}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Term</Text>
            <Text style={styles.detailValue}>{application.term_months} months</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Monthly</Text>
            <Text style={styles.detailValue}>
              ₱{parseFloat(application.monthly_amortization).toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Footer row */}
        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            Applied: {new Date(application.application_date).toLocaleDateString()}
          </Text>
          {(application.status === 'Disbursed' || application.status === 'Active') && (
            <Text style={styles.balanceText}>
              Balance: ₱{parseFloat(application.remaining_balance).toLocaleString()}
            </Text>
          )}
        </View>
        {(application.status === 'Active' || application.status === 'Disbursed') && application.released_at && (
          <View style={{ paddingHorizontal: 4, paddingBottom: 4 }}>
            <Text style={{ fontSize: 11, color: SUCCESS }}>
              Released: {new Date(application.released_at).toLocaleDateString()}
            </Text>
          </View>
        )}

        {/* Draft actions */}
        {application.status === 'Draft' && (
          <View style={styles.draftActions}>
            <TouchableOpacity style={styles.resumeButton} onPress={onResume}>
              <Text style={styles.draftActionText}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={onDeleteDraft}>
              <Text style={styles.draftActionText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const TAB_OPTIONS = [
  { label: 'ACTIVE\nLOANS',    value: 'active'    },
  { label: 'APPLIED\nLOANS',   value: 'applied'   },
  { label: 'AVAILABLE\nLOANS', value: 'available' },
];

const TabButton = React.memo(({ label, value, active, onPress }) => (
  <TouchableOpacity
    style={[styles.tabButton, active && styles.tabButtonActive]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
));

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function MyApplicationsScreen({ navigation }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [filter, setFilter]             = useState('active');
  const [loanTypes, setLoanTypes]       = useState([]);
  const [loanTypesLoading, setLoanTypesLoading] = useState(false);

  const loadApplications = useCallback(async () => {
    try {
      const data = await applicationService.getApplications();
      setApplications(data);
    } catch (error) {
      console.error('Load applications error:', error);
      Alert.alert('Error', 'Failed to load applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  useEffect(() => {
    if (filter !== 'available' || loanTypes.length > 0) return;
    setLoanTypesLoading(true);
    applicationService.getLoanTypes()
      .then((data) => setLoanTypes(data))
      .catch(() => Alert.alert('Error', 'Failed to load loan types'))
      .finally(() => setLoanTypesLoading(false));
  }, [filter, loanTypes]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadApplications();
  }, [loadApplications]);

  const handleApplicationPress = (application) => {
    navigation.navigate('ApplicationDetail', { id: application.id });
  };

  const handleResumeDraft = (application) => {
    navigation.navigate('ApplicationWizard', {
      screen: 'SelectLoanType',
      params: {
        resumeLoanTypeId:    application.loan_type_id,
        resumeApplicationId: application.id,
      },
    });
  };

  const handleDeleteDraft = (application) => {
    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this draft? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await applicationService.deleteDraftApplication(application.id);
              if (application.loan_type_id) await clearLoanTypeDraft(application.loan_type_id);
              setApplications((prev) => prev.filter((app) => app.id !== application.id));
            } catch (error) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete draft');
            }
          },
        },
      ]
    );
  };

  const filteredApplications = applications.filter((app) => {
    if (filter === 'active') {
      return ['Submitted', 'Verified by Bookkeeper', 'Pending Credit Committee',
        'Approved by Credit Committee', 'Disbursed', 'Active'].includes(app.status);
    }
    if (filter === 'applied') return app.status === 'Paid';
    if (filter === 'available') return app.status.includes('Rejected');
    return true;
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading applications…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Loans</Text>
          <Text style={styles.headerSubtitle}>{applications.length} total application{applications.length !== 1 ? 's' : ''}</Text>
        </View>

        {/* ── Segmented Tab Control ── */}
        <View style={styles.tabBar}>
          {TAB_OPTIONS.map((tab) => (
            <TabButton
              key={tab.value}
              label={tab.label}
              value={tab.value}
              active={filter === tab.value}
              onPress={() => setFilter(tab.value)}
            />
          ))}
        </View>
      </View>

      {/* ── Available Loans: horizontal swipeable loan type cards ── */}
      {filter === 'available' ? (
        loanTypesLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : (
          <ScrollView
            horizontal
            pagingEnabled={false}
            decelerationRate="fast"
            snapToInterval={CARD_W + CARD_MARGIN * 2}
            snapToAlignment="center"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ltPagerContent}
            style={{ flex: 1, backgroundColor: PAGE_BG }}
          >
            {loanTypes.length > 0 ? loanTypes.map((item, index) => (
              <View key={item.id.toString()} style={styles.ltCardWrapper}>
                <LoanTypeCard loanType={item} index={index} total={loanTypes.length} />
              </View>
            )) : (
              <View style={styles.ltEmpty}>
                <Text style={styles.emptyEmoji}>🏦</Text>
                <Text style={styles.emptyTitle}>No loan types available</Text>
                <Text style={styles.emptySub}>Please check back later.</Text>
              </View>
            )}
          </ScrollView>
        )
      ) : (
        /* ── Active / Applied: application list ── */
        <FlatList
          data={filteredApplications}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <ApplicationItem
              application={item}
              onPress={() => handleApplicationPress(item)}
              onResume={() => handleResumeDraft(item)}
              onDeleteDraft={() => handleDeleteDraft(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[PRIMARY]}
              tintColor={PRIMARY}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyTitle}>No applications found</Text>
              <Text style={styles.emptySub}>
                {'Try a different tab or start by applying for a loan'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  screen:           { flex: 1, backgroundColor: PRIMARY },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAGE_BG },
  loadingText:      { marginTop: 12, fontSize: 16, color: SECONDARY },

  // ── Header ──
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: GRAD,
    opacity: 0.55,
  },
  headerContent:  { marginBottom: 16 },
  headerTitle:    { fontSize: 24, fontFamily: 'Poppins_700Bold', color: WHITE },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.60)', marginTop: 4 },

  // ── Segmented Tab Control ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: WHITE,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 15,
  },
  tabButtonTextActive: {
    color: PRIMARY,
  },

  // ── List ──
  listContent: {
    padding: 16,
    paddingTop: 4,
    backgroundColor: PAGE_BG,
    flexGrow: 1,
  },

  // ── Application Card ──
  applicationCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardStripe: {
    width: 5,
  },
  cardInner: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardHeaderLeft: { flex: 1, marginRight: 8 },
  loanType:       { fontSize: 15, fontFamily: 'Poppins_700Bold', color: PRIMARY },
  applicationId:  { fontSize: 11, color: MUTED, marginTop: 2 },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 140,
  },
  statusText: { fontSize: 10, fontFamily: 'Poppins_700Bold' },

  // ── Card Body ──
  cardBody: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  detailLabel: { fontSize: 12, color: MUTED },
  detailValue: { fontSize: 12, color: PRIMARY, fontFamily: 'Poppins_600SemiBold' },

  // ── Card Footer ──
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,28,82,0.08)',
    paddingTop: 8,
  },
  dateText:    { fontSize: 11, color: MUTED },
  balanceText: { fontSize: 11, color: '#059669', fontFamily: 'Poppins_600SemiBold' },

  // ── Draft Actions ──
  draftActions: { flexDirection: 'row', marginTop: 10 },
  resumeButton: {
    flex: 1,
    backgroundColor: PRIMARY,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  draftActionText: { color: WHITE, fontSize: 13, fontFamily: 'Poppins_700Bold' },

  // ── Empty State ──
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyEmoji: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: PRIMARY, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: MUTED, textAlign: 'center' },

  // ── Available Loans pager ──
  ltPagerContent: {
    paddingHorizontal: 28,
    paddingVertical: 20,
    alignItems: 'flex-start',
  },
  ltCardWrapper: {
    width: CARD_W,
    marginHorizontal: CARD_MARGIN,
  },
  ltEmpty: {
    width: W - 56,
    marginHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
});

// ── Loan Type Card Styles ──────────────────────────────────────────────────────
const ltCard = StyleSheet.create({
  card: {
    backgroundColor: WHITE,
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  cardStrip: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 5,
    backgroundColor: ACCENT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cardCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  cardCount: {
    fontSize: 11,
    color: MUTED,
    fontFamily: 'Poppins_600SemiBold',
    letterSpacing: 0.5,
  },
  loanName: {
    fontSize: 20,
    fontFamily: 'Poppins_800ExtraBold',
    color: PRIMARY,
    marginBottom: 8,
  },
  loanDescription: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
    marginBottom: 10,
  },
  comakerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: WARN + '20',
    borderWidth: 1,
    borderColor: WARN,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 10,
  },
  comakerText: {
    fontSize: 11,
    color: '#92400E',
    fontFamily: 'Poppins_600SemiBold',
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15,28,82,0.1)',
    marginBottom: 10,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailBox: {
    width: '48%',
    backgroundColor: CARD_BG,
    borderRadius: 10,
    padding: 9,
    marginBottom: 7,
  },
  detailLabel: {
    fontSize: 10,
    color: MUTED,
    fontFamily: 'Poppins_500Medium',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
});
