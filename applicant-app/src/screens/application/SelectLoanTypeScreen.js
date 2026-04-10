/**
 * Select Loan Type Screen (Step 1)
 * Horizontal swipeable cards — one per loan type
 * Same #0f1c52 / #17235a palette as Dashboard
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApplication } from '../../context/ApplicationContext';
import applicationService from '../../services/applicationService';
import { getLoanTypeDraft, saveLoanTypeDraft } from '../../utils/applicationDraftStorage';

const { width: W } = Dimensions.get('window');

// ── Design Tokens (same as Dashboard) ─────────────────────────────────────────
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

const CARD_W      = W - 56;   // side margins 28 each
const CARD_MARGIN = 10;

// ── Business Logic (unchanged) ─────────────────────────────────────────────────
const toPositiveNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const normalizeLoanTypeId = (value) => {
  if (value == null) return null;
  if (value?.nativeEvent) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const mapDocumentsByType = (documents = []) => {
  const mapped = {};
  documents.forEach((doc) => {
    const normalized = { id: doc.id, uri: doc.file_path, name: doc.document_name, uploaded: true };
    if (doc.document_type === 'other_documents') {
      if (!mapped.other_documents) mapped.other_documents = [];
      mapped.other_documents.push(normalized);
      return;
    }
    mapped[doc.document_type] = normalized;
  });
  return mapped;
};

const mapCoMakers = (coMakers = []) =>
  coMakers.map((cm) => ({
    id: cm.id,
    user_id: cm.user_id,
    full_name: cm.full_name || cm.user_name || 'Co-maker',
    email: cm.user_email || cm.email || '',
    contact_number: cm.contact_number || '',
    status: cm.consent_given ? 'approved' : 'pending',
  }));

const inferResumeStep = ({ hasLoanDetails, coMakerRequirement, coMakerCount, hasDocuments, hasVerification, localStep }) => {
  let inferredStep = 2;
  if (hasLoanDetails) {
    if (coMakerRequirement > 0 && coMakerCount < coMakerRequirement) inferredStep = 4;
    else if (!hasDocuments) inferredStep = 5;
    else if (!hasVerification) inferredStep = 6;
    else inferredStep = 7;
  } else if ((localStep || 0) >= 3) {
    inferredStep = 3;
  }
  const mergedStep = Math.max(inferredStep, localStep || 0, 2);
  if (mergedStep === 4 && coMakerRequirement === 0) return 5;
  return Math.min(7, mergedStep);
};


const buildResumeState = (loanType, applicationDetail, localDraft, currentPersonalDetails) => {
  const amountFromServer       = toPositiveNumber(applicationDetail.amount_requested);
  const totalPayableFromServer = toPositiveNumber(applicationDetail.total_payable);

  const serverLoanDetails = {
    amount: amountFromServer > 0 ? String(amountFromServer) : '',
    termMonths: amountFromServer > 0 ? String(applicationDetail.term_months || '') : '',
    purpose: amountFromServer > 0 ? (applicationDetail.purpose || '') : '',
    calculatedAmortization: toPositiveNumber(applicationDetail.monthly_amortization) > 0
      ? String(applicationDetail.monthly_amortization) : null,
    calculatedTotal: totalPayableFromServer > 0 ? String(applicationDetail.total_payable) : null,
    calculatedInterest: totalPayableFromServer > 0 && amountFromServer > 0
      ? (totalPayableFromServer - amountFromServer).toFixed(2) : null,
  };

  const mergedLoanDetails  = { ...serverLoanDetails, ...(localDraft?.loanDetails || {}) };
  const coMakers           = mapCoMakers(applicationDetail.comakers || []);
  const documents          = mapDocumentsByType(applicationDetail.documents || []);
  const coMakerRequirement = loanType.required_comakers || 0;
  const hasLoanDetails     = Boolean(
    toPositiveNumber(mergedLoanDetails.amount) > 0 &&
    parseInt(mergedLoanDetails.termMonths, 10) > 0 &&
    (mergedLoanDetails.purpose || '').trim()
  );
  const hasDocuments    = (applicationDetail.documents || []).length > 0;
  const hasVerification = Boolean(
    applicationDetail.face_verification?.verified && applicationDetail.liveness_check?.verified
  );
  const localStep   = Number(localDraft?.currentStep) || 0;
  const currentStep = inferResumeStep({ hasLoanDetails, coMakerRequirement, coMakerCount: coMakers.length, hasDocuments, hasVerification, localStep });

  const stepValidation = {
    1: true,
    2: currentStep > 2 || hasLoanDetails,
    3: hasLoanDetails,
    4: coMakerRequirement > 0 ? coMakers.length >= coMakerRequirement : null,
    5: hasDocuments,
    6: hasVerification,
    7: false,
  };

  return {
    payload: {
      currentStep,
      personalDetails: { ...currentPersonalDetails, ...(localDraft?.personalDetails || {}) },
      loanDetails: mergedLoanDetails,
      coMakers,
      documents,
      faceVerification: {
        completed: Boolean(applicationDetail.face_verification?.completed),
        imageUri: null,
        verified: Boolean(applicationDetail.face_verification?.verified),
      },
      livenessCheck: {
        completed: Boolean(applicationDetail.liveness_check?.completed),
        method: null,
        verified: Boolean(applicationDetail.liveness_check?.verified),
      },
      stepValidation,
      errors: {},
    },
    currentStep,
  };
};

// ── Pagination Dots ────────────────────────────────────────────────────────────
const PaginationDots = ({ count, active }) => (
  <View style={styles.dotsRow}>
    {Array.from({ length: count }).map((_, i) => (
      <View key={i} style={[styles.dot, i === active && styles.dotActive]} />
    ))}
  </View>
);

// ── Loan Type Card ─────────────────────────────────────────────────────────────
const LoanTypeCard = ({ loanType, selected, onSelect, index, total }) => (
  <TouchableOpacity
    style={[styles.loanCard, selected && styles.loanCardSelected]}
    onPress={onSelect}
    activeOpacity={0.88}
  >
    {/* Top accent strip */}
    <View style={[styles.cardStrip, { backgroundColor: selected ? PRIMARY : ACCENT }]} />

    {/* Card number */}
    <View style={styles.cardCountRow}>
      <Text style={styles.cardCount}>{index + 1} / {total}</Text>
      {selected && (
        <View style={styles.selectedBadge}>
          <Text style={styles.selectedBadgeText}>✓ Selected</Text>
        </View>
      )}
    </View>

    {/* Loan name */}
    <Text style={[styles.loanName, selected && styles.loanNameSelected]}>
      {loanType.loan_name}
    </Text>

    {/* Description */}
    <Text style={styles.loanDescription}>
      {loanType.description || 'Standard loan product'}
    </Text>

    {/* Co-maker badge */}
    {loanType.required_comakers > 0 && (
      <View style={styles.comakerBadge}>
        <Text style={styles.comakerText}>
          👥 {loanType.required_comakers} Co-maker{loanType.required_comakers > 1 ? 's' : ''} required
        </Text>
      </View>
    )}

    {/* Divider */}
    <View style={styles.cardDivider} />

    {/* Detail rows */}
    <View style={styles.detailsGrid}>
      <View style={styles.detailBox}>
        <Text style={styles.detailLabel}>Min Amount</Text>
        <Text style={[styles.detailValue, { color: SUCCESS }]}>
          ₱{parseFloat(loanType.min_amount).toLocaleString()}
        </Text>
      </View>
      <View style={styles.detailBox}>
        <Text style={styles.detailLabel}>Max Amount</Text>
        <Text style={[styles.detailValue, { color: PRIMARY }]}>
          ₱{parseFloat(loanType.max_amount).toLocaleString()}
        </Text>
      </View>
      <View style={styles.detailBox}>
        <Text style={styles.detailLabel}>Interest Rate</Text>
        <Text style={[styles.detailValue, { color: WARN }]}>
          {loanType.interest_rate}% p.a.
        </Text>
      </View>
      <View style={styles.detailBox}>
        <Text style={styles.detailLabel}>Max Term</Text>
        <Text style={[styles.detailValue, { color: ACCENT }]}>
          {loanType.max_term_months} months
        </Text>
      </View>
    </View>

    {/* Tap hint */}
    {!selected && (
      <Text style={styles.tapHint}>Tap to select this loan type</Text>
    )}
  </TouchableOpacity>
);

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function SelectLoanTypeScreen({ navigation, route }) {
  const { state, setLoanType, dispatch } = useApplication();
  const [loanTypes, setLoanTypes]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);
  const [selectedId, setSelectedId]     = useState(null);
  const [resumeHandled, setResumeHandled] = useState(false);
  const [activePage, setActivePage]     = useState(0);

  const resumeLoanTypeId    = route?.params?.resumeLoanTypeId;
  const resumeApplicationId = route?.params?.resumeApplicationId;
  const autoStart           = route?.params?.autoStart ?? false;

  useEffect(() => { loadLoanTypes(); }, []);

  useEffect(() => {
    if (state.loanType?.id) setSelectedId(normalizeLoanTypeId(state.loanType.id));
  }, [state.loanType]);

  const loadLoanTypes = async () => {
    try {
      const data = await applicationService.getLoanTypes();
      setLoanTypes(data);
    } catch (error) {
      console.error('Load loan types error:', error);
      Alert.alert('Error', 'Failed to load loan types');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (loanType) => {
    setSelectedId(normalizeLoanTypeId(loanType.id));
  };

  const handleContinue = async (overrideLoanTypeId = null, resumeId = null) => {
    const loanTypeId = normalizeLoanTypeId(overrideLoanTypeId) ?? normalizeLoanTypeId(selectedId);
    if (!loanTypeId) {
      Alert.alert('Selection Required', 'Please select a loan type to continue.');
      return;
    }
    const selectedLoanType = loanTypes.find((lt) => normalizeLoanTypeId(lt.id) === loanTypeId);
    if (!selectedLoanType) return;

    setCreating(true);
    try {
      let existingDraft = null;
      if (resumeId) {
        existingDraft = { id: resumeId };
      } else {
        const allApplications = await applicationService.getApplications();
        existingDraft = allApplications.find(
          (app) =>
            ['Draft', 'Submitted'].includes(app.status) &&
            (app.loan_type_id === loanTypeId || app.loan_type === selectedLoanType.loan_name)
        );
      }

      if (existingDraft) {
        const detail      = await applicationService.getApplication(existingDraft.id);
        const storedDraft = await getLoanTypeDraft(loanTypeId);
        const localDraft  = storedDraft?.applicationId === existingDraft.id ? storedDraft : null;

        const { payload, currentStep } = buildResumeState(
          selectedLoanType, detail, localDraft, state.personalDetails
        );

        dispatch({ type: 'RESET' });
        setLoanType(selectedLoanType, selectedLoanType.required_comakers || 0);
        dispatch({ type: 'SET_APPLICATION_ID', payload: existingDraft.id });
        dispatch({ type: 'LOAD_APPLICATION', payload });

        await saveLoanTypeDraft(loanTypeId, {
          applicationId: existingDraft.id,
          currentStep,
          personalDetails: payload.personalDetails,
          loanDetails: payload.loanDetails,
        });

        navigation.navigate('PersonalDetails');
        return;
      }

      const result = await applicationService.createApplication(loanTypeId);

      dispatch({ type: 'RESET' });
      setLoanType(selectedLoanType, selectedLoanType.required_comakers || 0);
      dispatch({ type: 'SET_APPLICATION_ID', payload: result.id });
      dispatch({ type: 'SET_CURRENT_STEP', payload: 2 });

      await saveLoanTypeDraft(loanTypeId, {
        applicationId: result.id,
        currentStep: 2,
        personalDetails: {},
        loanDetails: {},
      });

      navigation.navigate('PersonalDetails');
    } catch (error) {
      console.error('Create application error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to create application');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (resumeHandled) return;
    if (!resumeLoanTypeId || loading) return;
    const selectedLoanType = loanTypes.find((lt) => lt.id === resumeLoanTypeId);
    if (!selectedLoanType) return;
    setSelectedId(normalizeLoanTypeId(resumeLoanTypeId));
    setResumeHandled(true);
    handleContinue(resumeLoanTypeId, resumeApplicationId);
  }, [resumeHandled, resumeLoanTypeId, resumeApplicationId, loading, loanTypes]);

  const handlePageScroll = (e) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_MARGIN * 2));
    setActivePage(page);
  };

  if (loading || (autoStart && creating)) {
    return (
      <SafeAreaView style={styles.loadingScreen} edges={['bottom']}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>
          {autoStart && creating ? 'Setting up your application…' : 'Loading loan types…'}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* ── Fixed Header ── */}
      <View style={styles.header}>
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <Text style={styles.headerStep}>Step 1 of 8</Text>
          <Text style={styles.headerTitle}>Choose Your Loan Type</Text>
          <Text style={styles.headerSub}>Swipe to browse, tap to select</Text>
          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>
      </View>

      {/* ── Body (light blue bg below header) ── */}
      <View style={styles.body}>

      {/* ── Swipeable Cards ── */}
      <View style={styles.pagerArea}>
        {loanTypes.length > 0 ? (
          <>
            <ScrollView
              horizontal
              pagingEnabled={false}
              decelerationRate="fast"
              snapToInterval={CARD_W + CARD_MARGIN * 2}
              snapToAlignment="center"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pagerContent}
              onMomentumScrollEnd={handlePageScroll}
            >
              {loanTypes.map((item, index) => (
                <View key={item.id.toString()} style={styles.cardWrapper}>
                  <LoanTypeCard
                    loanType={item}
                    selected={selectedId === item.id}
                    onSelect={() => handleSelect(item)}
                    index={index}
                    total={loanTypes.length}
                  />
                </View>
              ))}
            </ScrollView>
            <PaginationDots count={loanTypes.length} active={activePage} />
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyTitle}>No loan types available</Text>
            <Text style={styles.emptySub}>Please check back later.</Text>
          </View>
        )}
      </View>

      {/* ── Footer Continue Button ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueBtn,
            (!selectedId || creating) && styles.continueBtnDisabled,
          ]}
          onPress={() => handleContinue()}
          disabled={!selectedId || creating}
          activeOpacity={0.85}
        >
          {creating ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text style={styles.continueBtnText}>
              {selectedId ? 'Continue →' : 'Select a Loan Type'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      </View>{/* end body */}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({

  screen:        { flex: 1, backgroundColor: PRIMARY },
  body:          { flex: 1, backgroundColor: PAGE_BG },
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
  headerContent: {},
  headerStep: {
    fontSize: 11,
    fontFamily: 'Poppins_700Bold',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    color: WHITE,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.60)',
    marginBottom: 14,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    width: '12.5%',
    height: '100%',
    backgroundColor: WHITE,
    borderRadius: 2,
  },

  // ── Pager ──
  pagerArea: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
  },
  pagerContent: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignItems: 'stretch',
  },
  cardWrapper: {
    width: CARD_W,
    marginHorizontal: CARD_MARGIN,
  },

  // ── Loan Card ──
  loanCard: {
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
  loanCardSelected: {
    borderColor: PRIMARY,
    backgroundColor: CARD_BG,
  },
  cardStrip: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 5,
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
  selectedBadge: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  selectedBadgeText: {
    fontSize: 10,
    color: WHITE,
    fontFamily: 'Poppins_700Bold',
  },
  loanName: {
    fontSize: 20,
    fontFamily: 'Poppins_800ExtraBold',
    color: SECONDARY,
    marginBottom: 8,
  },
  loanNameSelected: {
    color: PRIMARY,
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
  tapHint: {
    textAlign: 'center',
    fontSize: 11,
    color: MUTED,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // ── Pagination Dots ──
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 8,
  },
  dot:       { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(15,28,82,0.18)', marginHorizontal: 4 },
  dotActive: { width: 22, height: 7, borderRadius: 3.5, backgroundColor: PRIMARY },

  // ── Empty State ──
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyEmoji: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins_700Bold', color: PRIMARY, marginBottom: 6 },
  emptySub:   { fontSize: 13, color: MUTED, textAlign: 'center' },

  // ── Footer ──
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: WHITE,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15,28,82,0.08)',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 8,
  },
  continueBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  continueBtnDisabled: {
    backgroundColor: MUTED,
    shadowColor: MUTED,
  },
  continueBtnText: {
    color: WHITE,
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    letterSpacing: 0.3,
  },
});
