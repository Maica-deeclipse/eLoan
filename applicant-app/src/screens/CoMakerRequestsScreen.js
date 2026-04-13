/**
 * Co-Maker Requests Screen
 *
 * Lists all loan applications where the logged-in user has been added as a
 * co-maker.  For each pending request the user can view a summary of the loan
 * and then accept or reject the request.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import applicationService from '../services/applicationService';
import logger from '../utils/logger';

// ── Design tokens (match rest of app) ────────────────────────────────────────
const PRIMARY   = '#0f1c52';
const ACCENT    = '#4D80E4';
const WHITE     = '#FFFFFF';
const PAGE_BG   = '#EEF4FF';
const SUCCESS   = '#10B981';
const DANGER    = '#EF4444';
const WARN      = '#F59E0B';
const MUTED     = '#94A3B8';
const SECONDARY = '#64748B';

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: WARN,    icon: 'time-outline' },
  accepted: { label: 'Accepted', color: SUCCESS,  icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rejected', color: DANGER,   icon: 'close-circle-outline' },
};

function formatCurrency(value) {
  if (value == null) return '—';
  return '₱' + parseFloat(value).toLocaleString('en-PH', { minimumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ── Loan Summary Modal ────────────────────────────────────────────────────────
const LoanSummaryModal = ({ visible, request, onAccept, onReject, onClose, responding }) => {
  if (!request) return null;
  const { application, applicant_name, applicant_email } = request;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={modal.container}>
        {/* Header */}
        <View style={modal.header}>
          <TouchableOpacity onPress={onClose} style={modal.closeBtn}>
            <Ionicons name="close" size={26} color={PRIMARY} />
          </TouchableOpacity>
          <Text style={modal.headerTitle}>Loan Summary</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView style={modal.body} contentContainerStyle={modal.bodyContent}>
          {/* Applicant card */}
          <View style={modal.section}>
            <Text style={modal.sectionLabel}>Applicant</Text>
            <View style={modal.infoRow}>
              <Ionicons name="person-circle-outline" size={40} color={ACCENT} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={modal.infoName}>{applicant_name}</Text>
                <Text style={modal.infoSub}>{applicant_email}</Text>
              </View>
            </View>
          </View>

          {/* Loan details */}
          <View style={modal.section}>
            <Text style={modal.sectionLabel}>Loan Details</Text>
            <View style={modal.detailCard}>
              <DetailRow label="Loan Type"         value={application.loan_type} />
              <DetailRow label="Amount Requested"  value={formatCurrency(application.amount_requested)} />
              <DetailRow label="Term"              value={`${application.term_months} months`} />
              <DetailRow label="Monthly Payment"   value={formatCurrency(application.monthly_amortization)} />
              <DetailRow label="Total Payable"     value={formatCurrency(application.total_payable)} />
              <DetailRow label="Purpose"           value={application.purpose || '—'} />
              <DetailRow label="Application Date"  value={formatDate(application.application_date)} last />
            </View>
          </View>

          {/* Info notice */}
          <View style={modal.notice}>
            <Ionicons name="information-circle-outline" size={20} color={ACCENT} />
            <Text style={modal.noticeText}>
              As a co-maker you will serve as a guarantor for this loan. By accepting, you
              acknowledge your responsibility if the applicant defaults on payment.
            </Text>
          </View>
        </ScrollView>

        {/* Action buttons — only shown for pending requests */}
        {request.status === 'pending' && (
          <View style={modal.actions}>
            <TouchableOpacity
              style={[modal.actionBtn, modal.rejectBtn]}
              onPress={onReject}
              disabled={responding}
            >
              {responding === 'reject' ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={20} color={WHITE} />
                  <Text style={modal.actionBtnText}>Reject</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[modal.actionBtn, modal.acceptBtn]}
              onPress={onAccept}
              disabled={responding}
            >
              {responding === 'accept' ? (
                <ActivityIndicator color={WHITE} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={WHITE} />
                  <Text style={modal.actionBtnText}>Accept</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const DetailRow = ({ label, value, last = false }) => (
  <View style={[modal.detailRow, !last && modal.detailRowBorder]}>
    <Text style={modal.detailLabel}>{label}</Text>
    <Text style={modal.detailValue}>{value}</Text>
  </View>
);

// ── Request Card ──────────────────────────────────────────────────────────────
const RequestCard = ({ item, onPress }) => {
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  return (
    <TouchableOpacity style={card.container} onPress={() => onPress(item)} activeOpacity={0.85}>
      <View style={card.header}>
        <View style={[card.statusDot, { backgroundColor: cfg.color }]} />
        <Text style={card.loanType}>{item.application.loan_type}</Text>
        <View style={[card.badge, { backgroundColor: cfg.color + '20' }]}>
          <Ionicons name={cfg.icon} size={13} color={cfg.color} />
          <Text style={[card.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      <View style={card.body}>
        <View style={card.bodyCol}>
          <Text style={card.bodyLabel}>Applicant</Text>
          <Text style={card.bodyValue}>{item.applicant_name}</Text>
        </View>
        <View style={card.bodyCol}>
          <Text style={card.bodyLabel}>Amount</Text>
          <Text style={card.bodyValue}>{formatCurrency(item.application.amount_requested)}</Text>
        </View>
        <View style={card.bodyCol}>
          <Text style={card.bodyLabel}>Term</Text>
          <Text style={card.bodyValue}>{item.application.term_months} mo.</Text>
        </View>
      </View>

      <View style={card.footer}>
        <Text style={card.footerDate}>Requested {formatDate(item.agreed_at)}</Text>
        {item.status === 'pending' && (
          <Text style={card.footerCta}>Tap to review →</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function CoMakerRequestsScreen({ navigation }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [responding, setResponding] = useState(null); // 'accept' | 'reject' | null

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await applicationService.getCoMakerRequests();
      setRequests(data);
    } catch (err) {
      logger.error('CoMakerRequestsScreen load error:', err);
      Alert.alert('Error', 'Failed to load co-maker requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const openModal = (item) => {
    setSelected(item);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelected(null);
    setResponding(null);
  };

  const handleRespond = async (action) => {
    setResponding(action);
    try {
      await applicationService.respondToCoMakerRequest(selected.id, action);
      // Update local state immediately
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selected.id
            ? { ...r, status: action === 'accept' ? 'accepted' : 'rejected' }
            : r
        )
      );
      closeModal();
      Alert.alert(
        action === 'accept' ? 'Request Accepted' : 'Request Rejected',
        action === 'accept'
          ? `You have accepted the co-maker request from ${selected.applicant_name}. They have been notified.`
          : `You have rejected the co-maker request from ${selected.applicant_name}. They have been notified.`
      );
    } catch (err) {
      logger.error('Respond error:', err);
      Alert.alert('Error', err.response?.data?.error || 'Failed to respond to request.');
      setResponding(null);
    }
  };

  const confirmRespond = (action) => {
    const label = action === 'accept' ? 'accept' : 'reject';
    Alert.alert(
      `${label.charAt(0).toUpperCase() + label.slice(1)} Request`,
      `Are you sure you want to ${label} this co-maker request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: label.charAt(0).toUpperCase() + label.slice(1), style: action === 'reject' ? 'destructive' : 'default', onPress: () => handleRespond(action) },
      ]
    );
  };

  const pending  = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');

  if (loading) {
    return (
      <SafeAreaView style={s.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={PRIMARY} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Co-Maker Requests</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={[]}           /* We render sections manually via ListHeaderComponent */
        renderItem={null}
        keyExtractor={() => 'noop'}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        ListHeaderComponent={() => (
          <View style={{ paddingBottom: 32 }}>
            {requests.length === 0 ? (
              <View style={s.emptyState}>
                <Ionicons name="people-outline" size={64} color={MUTED} />
                <Text style={s.emptyTitle}>No Requests</Text>
                <Text style={s.emptySub}>You have not been added as a co-maker yet.</Text>
              </View>
            ) : (
              <>
                {/* Pending */}
                {pending.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>
                      Pending{' '}
                      <Text style={[s.sectionTitle, { color: WARN }]}>({pending.length})</Text>
                    </Text>
                    {pending.map((item) => (
                      <RequestCard key={item.id} item={item} onPress={openModal} />
                    ))}
                  </View>
                )}

                {/* Resolved */}
                {resolved.length > 0 && (
                  <View style={s.section}>
                    <Text style={s.sectionTitle}>History</Text>
                    {resolved.map((item) => (
                      <RequestCard key={item.id} item={item} onPress={openModal} />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      />

      {/* Loan summary + respond modal */}
      <LoanSummaryModal
        visible={modalVisible}
        request={selected}
        onClose={closeModal}
        onAccept={() => confirmRespond('accept')}
        onReject={() => confirmRespond('reject')}
        responding={responding}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: PAGE_BG },
  centered:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PAGE_BG },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn:      { padding: 4 },
  topBarTitle:  { fontSize: 18, fontFamily: 'Poppins_700Bold', color: PRIMARY },
  section:      { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 14, fontFamily: 'Poppins_600SemiBold', color: SECONDARY, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  emptyState:   { alignItems: 'center', marginTop: 80, paddingHorizontal: 32 },
  emptyTitle:   { fontSize: 20, fontFamily: 'Poppins_700Bold', color: PRIMARY, marginTop: 16 },
  emptySub:     { fontSize: 14, color: MUTED, textAlign: 'center', marginTop: 8, lineHeight: 22 },
});

const card = StyleSheet.create({
  container: {
    backgroundColor: WHITE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusDot:   { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  loanType:    { flex: 1, fontSize: 15, fontFamily: 'Poppins_700Bold', color: PRIMARY },
  badge:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText:   { fontSize: 11, fontFamily: 'Poppins_600SemiBold', marginLeft: 4 },
  body:        { flexDirection: 'row', marginBottom: 12 },
  bodyCol:     { flex: 1 },
  bodyLabel:   { fontSize: 11, color: MUTED, fontFamily: 'Poppins_400Regular' },
  bodyValue:   { fontSize: 13, color: PRIMARY, fontFamily: 'Poppins_600SemiBold', marginTop: 2 },
  footer:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  footerDate:  { fontSize: 11, color: MUTED },
  footerCta:   { fontSize: 12, color: ACCENT, fontFamily: 'Poppins_600SemiBold' },
});

const modal = StyleSheet.create({
  container:      { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle:    { fontSize: 18, fontFamily: 'Poppins_700Bold', color: PRIMARY },
  closeBtn:       { padding: 4 },
  body:           { flex: 1 },
  bodyContent:    { paddingBottom: 24 },
  section:        { backgroundColor: WHITE, marginTop: 16, marginHorizontal: 16, borderRadius: 16, padding: 16 },
  sectionLabel:   { fontSize: 11, color: MUTED, fontFamily: 'Poppins_600SemiBold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoRow:        { flexDirection: 'row', alignItems: 'center' },
  infoName:       { fontSize: 16, fontFamily: 'Poppins_700Bold', color: PRIMARY },
  infoSub:        { fontSize: 13, color: SECONDARY, marginTop: 2 },
  detailCard:     { borderRadius: 12, overflow: 'hidden' },
  detailRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10 },
  detailRowBorder:{ borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailLabel:    { fontSize: 13, color: SECONDARY, flex: 1 },
  detailValue:    { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: PRIMARY, flex: 1, textAlign: 'right' },
  notice: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 16,
    alignItems: 'flex-start',
  },
  noticeText:     { flex: 1, fontSize: 12, color: SECONDARY, lineHeight: 18, marginLeft: 10 },
  actions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  acceptBtn:      { backgroundColor: SUCCESS },
  rejectBtn:      { backgroundColor: DANGER },
  actionBtnText:  { color: WHITE, fontSize: 15, fontFamily: 'Poppins_700Bold' },
});
