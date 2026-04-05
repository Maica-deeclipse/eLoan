/**
 * Loan Details Screen (Step 3)
 * Collects loan amount, term, and purpose with real-time amortization calculation
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApplication } from '../../context/ApplicationContext';
import applicationService from '../../services/applicationService';
import { getLoanTypeDraft, saveLoanTypeDraft } from '../../utils/applicationDraftStorage';
import DropdownPicker from '../../components/DropdownPicker';
import { isSemiMonthlyAllowed } from '../../config/loanTypeConfig';

// Fixed term options — only show values that don't exceed the loan type's max term
const FIXED_TERM_MONTHS = [3, 6, 12, 24, 36, 48];

// Fixed loan purpose options
const LOAN_PURPOSES = [
  { label: 'Education / Tuition Fees', value: 'Education / Tuition Fees' },
  { label: 'Medical / Health Expenses', value: 'Medical / Health Expenses' },
  { label: 'Home Improvement / Repair', value: 'Home Improvement / Repair' },
  { label: 'Business Capital', value: 'Business Capital' },
  { label: 'Emergency / Calamity Relief', value: 'Emergency / Calamity Relief' },
  { label: 'Personal / Consumer Needs', value: 'Personal / Consumer Needs' },
  { label: 'Travel / Transportation', value: 'Travel / Transportation' },
  { label: 'Others', value: 'Others' },
];

const INSTALLMENT_TYPE_OPTIONS = [
  { label: 'Monthly', value: 'monthly' },
  { label: 'Semi-Monthly (Every 15 days)', value: 'semi_monthly' },
];

/**
 * Generate stepped amount options between min and max.
 * Produces at most ~10 steps for a clean dropdown.
 */
function generateAmountOptions(minAmount, maxAmount) {
  const min = parseFloat(minAmount) || 0;
  const max = parseFloat(maxAmount) || 0;
  if (min >= max) return [{ label: `₱${min.toLocaleString()}`, value: min }];

  const range = max - min;
  // Pick a round step size that yields 6–12 options
  const rawStep = range / 10;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = Math.ceil(rawStep / magnitude) * magnitude;

  const options = [];
  for (let v = min; v <= max + 0.01; v += step) {
    const rounded = Math.round(v / magnitude) * magnitude;
    if (rounded >= min && rounded <= max) {
      options.push({
        label: `₱${rounded.toLocaleString()}`,
        value: rounded,
      });
    }
  }
  // Always include max
  if (!options.find((o) => o.value === max)) {
    options.push({ label: `₱${max.toLocaleString()}`, value: max });
  }
  return options;
}

export default function LoanDetailsScreen({ navigation }) {
  const { state, setLoanDetails, dispatch, getNextStep, getPostLoanDetailsRoute } = useApplication();
  const { loanType, applicationId, coMakerRequirement, loanDetails: savedLoanDetails } = state;

  const [amount, setAmount] = useState(''); // stored as string for API; value from dropdown is a number
  const [termMonths, setTermMonths] = useState('');
  const [purpose, setPurpose] = useState('');
  const [installmentType, setInstallmentType] = useState('monthly');
  const [calculation, setCalculation] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Show installment type picker only for loan types that support semi-monthly
  const showInstallmentType = useMemo(
    () => loanType && isSemiMonthlyAllowed(loanType.loan_name),
    [loanType?.loan_name]
  );

  // Amount dropdown options derived from loan type constraints
  const amountOptions = useMemo(() => {
    if (!loanType) return [];
    return generateAmountOptions(loanType.min_amount, loanType.max_amount);
  }, [loanType?.min_amount, loanType?.max_amount]);

  useEffect(() => {
    if (savedLoanDetails) {
      setAmount(savedLoanDetails.amount ? String(savedLoanDetails.amount) : '');
      setTermMonths(savedLoanDetails.termMonths ? String(savedLoanDetails.termMonths) : '');
      setPurpose(savedLoanDetails.purpose || '');
      setInstallmentType(savedLoanDetails.installmentType || 'monthly');

      if (
        savedLoanDetails.calculatedAmortization &&
        savedLoanDetails.calculatedTotal
      ) {
        setCalculation({
          monthly_amortization: savedLoanDetails.calculatedAmortization,
          total_payable: savedLoanDetails.calculatedTotal,
          total_interest: savedLoanDetails.calculatedInterest || 0,
        });
      }
    }
  }, [savedLoanDetails]);

  useEffect(() => {
    const loadLocalDraft = async () => {
      if (!loanType?.id || !applicationId) return;

      const localDraft = await getLoanTypeDraft(loanType.id);
      if (
        localDraft?.applicationId !== applicationId ||
        !localDraft.loanDetails
      ) {
        return;
      }

      const localLoanDetails = localDraft.loanDetails;
      if (localLoanDetails.amount !== undefined) {
        setAmount(String(localLoanDetails.amount || ''));
      }
      if (localLoanDetails.termMonths !== undefined) {
        setTermMonths(String(localLoanDetails.termMonths || ''));
      }
      if (localLoanDetails.purpose !== undefined) {
        setPurpose(localLoanDetails.purpose || '');
      }
      if (localLoanDetails.installmentType !== undefined) {
        setInstallmentType(localLoanDetails.installmentType || 'monthly');
      }
    };

    loadLocalDraft();
  }, [loanType?.id, applicationId]);

  // Debounced calculation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (amount && termMonths && !errors.amount && !errors.term) {
        calculateAmortization();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, termMonths]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loanType?.id || !applicationId) return;

      saveLoanTypeDraft(loanType.id, {
        applicationId,
        currentStep: 3,
        loanDetails: {
          amount,
          termMonths,
          purpose,
          installmentType,
        },
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [loanType?.id, applicationId, amount, termMonths, purpose, installmentType]);

  const validateAmount = useCallback((value) => {
    if (!loanType) return null;
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return 'Please enter a valid amount';
    if (num < parseFloat(loanType.min_amount)) {
      return `Minimum amount is ₱${parseFloat(loanType.min_amount).toLocaleString()}`;
    }
    if (num > parseFloat(loanType.max_amount)) {
      return `Maximum amount is ₱${parseFloat(loanType.max_amount).toLocaleString()}`;
    }
    return null;
  }, [loanType]);

  const validateTerm = useCallback((value) => {
    if (!loanType) return null;
    const num = parseInt(value);
    if (isNaN(num) || num < 1) return 'Please enter a valid term';
    if (num > loanType.max_term_months) {
      return `Maximum term is ${loanType.max_term_months} months`;
    }
    return null;
  }, [loanType]);

  const handleAmountChange = (value) => {
    // value from dropdown is a number; convert to string for API compatibility
    const strVal = String(value);
    setAmount(strVal);
    const error = validateAmount(strVal);
    setErrors((prev) => ({ ...prev, amount: error }));
    if (error) setCalculation(null);
  };

  const handleTermChange = (value) => {
    setTermMonths(value);
    const error = validateTerm(value);
    setErrors((prev) => ({ ...prev, term: error }));
    if (error) setCalculation(null);
  };

  const handlePurposeChange = (value) => {
    setPurpose(value);
    setErrors((prev) => ({ ...prev, purpose: null }));
  };

  const calculateAmortization = async () => {
    if (!loanType || !amount || !termMonths) return;

    setCalculating(true);
    try {
      const result = await applicationService.calculateAmortization(
        loanType.id,
        parseFloat(amount),
        parseInt(termMonths)
      );
      setCalculation(result);
    } catch (error) {
      console.error('Calculation error:', error);
      setCalculation(null);
    } finally {
      setCalculating(false);
    }
  };

  const handleContinue = async () => {
    // Validate all fields
    const amountError = validateAmount(amount);
    const termError = validateTerm(termMonths);

    if (amountError || termError || !purpose.trim()) {
      setErrors({
        amount: amountError,
        term: termError,
        purpose: !purpose.trim() ? 'Loan purpose is required' : null,
      });
      Alert.alert('Validation Error', 'Please fill in all required fields correctly.');
      return;
    }

    setSaving(true);
    try {
      // Update application step
      await applicationService.updateStep(applicationId, 3, {
        amount_requested: parseFloat(amount),
        term_months: parseInt(termMonths),
        purpose: purpose,
        installment_type: installmentType,
      });

      // Update context
      setLoanDetails({
        amount,
        termMonths,
        purpose,
        installmentType,
        calculatedAmortization: calculation?.monthly_amortization,
        calculatedTotal: calculation?.total_payable,
        calculatedInterest: calculation?.total_interest,
      });

      dispatch({ type: 'VALIDATE_LOAN_DETAILS', payload: true });

      // Navigate to next step (LoanFormData, CoMaker, or DocumentUpload)
      const nextRoute = getPostLoanDetailsRoute();
      const nextStep = getNextStep(3);
      dispatch({ type: 'SET_CURRENT_STEP', payload: nextStep });

      if (loanType?.id) {
        await saveLoanTypeDraft(loanType.id, {
          applicationId,
          currentStep: nextStep,
          loanDetails: {
            amount,
            termMonths,
            purpose,
            installmentType,
          },
        });
      }

      navigation.navigate(nextRoute);
    } catch (error) {
      console.error('Save loan details error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save loan details');
    } finally {
      setSaving(false);
    }
  };

  if (!loanType) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <Text style={styles.errorText}>Loan type not selected</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '37.5%' }]} />
          </View>
          <Text style={styles.progressText}>Step 3 of 8</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Loan Type Summary */}
          <View style={styles.loanTypeCard}>
            <Text style={styles.loanTypeName}>{loanType.loan_name}</Text>
            <View style={styles.loanTypeDetails}>
              <Text style={styles.loanTypeInfo}>
                Interest: {loanType.interest_rate}% p.a.
              </Text>
              <Text style={styles.loanTypeInfo}>
                Max Term: {loanType.max_term_months} months
              </Text>
            </View>
            <Text style={styles.loanTypeRange}>
              Amount: ₱{parseFloat(loanType.min_amount).toLocaleString()} - ₱{parseFloat(loanType.max_amount).toLocaleString()}
            </Text>
          </View>

          {/* Loan Amount */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loan Details</Text>

            <DropdownPicker
              label="Loan Amount (₱) *"
              placeholder={`Select amount (₱${parseFloat(loanType.min_amount).toLocaleString()} – ₱${parseFloat(loanType.max_amount).toLocaleString()})`}
              value={amount ? parseFloat(amount) : null}
              options={amountOptions}
              onChange={handleAmountChange}
              hasError={!!errors.amount}
              errorMessage={errors.amount}
            />

            <View style={styles.field}>
              <Text style={styles.label}>Term (Months) *</Text>
              <DropdownPicker
                placeholder={`Select term (max ${loanType.max_term_months} months)`}
                value={termMonths ? parseInt(termMonths) : null}
                options={FIXED_TERM_MONTHS
                  .filter((t) => t <= loanType.max_term_months)
                  .map((t) => ({ label: `${t} months`, value: t }))}
                onChange={(val) => handleTermChange(String(val))}
                hasError={!!errors.term}
                errorMessage={errors.term}
              />
            </View>

            <DropdownPicker
              label="Purpose of Loan *"
              placeholder="Select purpose"
              value={purpose || null}
              options={LOAN_PURPOSES}
              onChange={handlePurposeChange}
              hasError={!!errors.purpose}
              errorMessage={errors.purpose}
            />

            {showInstallmentType && (
              <View style={styles.field}>
                <DropdownPicker
                  label="Payment Schedule *"
                  placeholder="Select payment schedule"
                  value={installmentType}
                  options={INSTALLMENT_TYPE_OPTIONS}
                  onChange={(val) => setInstallmentType(val)}
                />
              </View>
            )}
          </View>

          {/* Amortization Calculator */}
          {(calculation || calculating) && (
            <View style={styles.calculationCard}>
              <Text style={styles.calculationTitle}>Loan Calculation</Text>
              {calculating ? (
                <ActivityIndicator color="#0f1c52" />
              ) : (
                <>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Monthly Payment</Text>
                    <Text style={styles.calcValueMain}>
                      ₱{parseFloat(calculation.monthly_amortization).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Total Interest</Text>
                    <Text style={styles.calcValue}>
                      ₱{parseFloat(calculation.total_interest).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Total Payable</Text>
                    <Text style={styles.calcValue}>
                      ₱{parseFloat(calculation.total_payable).toLocaleString()}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Co-Maker Notice */}
          {coMakerRequirement > 0 && (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeIcon}>ℹ️</Text>
              <Text style={styles.noticeText}>
                This loan type requires {coMakerRequirement} co-maker{coMakerRequirement > 1 ? 's' : ''}.
                You'll add them in the next step.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.continueButton,
              (!calculation || saving) && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!calculation || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF4FF',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEF4FF',
  },
  progressContainer: {
    padding: 16,
    paddingBottom: 0,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(15,28,82,0.1)',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0f1c52',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'right',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 100,
  },
  loanTypeCard: {
    backgroundColor: '#0f1c52',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  loanTypeName: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    marginBottom: 8,
  },
  loanTypeDetails: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  loanTypeInfo: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.70)',
    marginRight: 16,
  },
  loanTypeRange: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#6b7280',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#0f1c52',
    marginBottom: 6,
    fontFamily: 'Poppins_500Medium',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(15,28,82,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f1c52',
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  linkText: {
    fontSize: 14,
    color: '#0f1c52',
    marginTop: 8,
  },
  calculationCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(77,128,228,0.3)',
  },
  calculationTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#0f1c52',
    marginBottom: 12,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  calcLabel: {
    fontSize: 14,
    color: '#0f1c52',
  },
  calcValue: {
    fontSize: 14,
    color: '#0f1c52',
    fontFamily: 'Poppins_500Medium',
  },
  calcValueMain: {
    fontSize: 18,
    color: '#0f1c52',
    fontFamily: 'Poppins_700Bold',
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  noticeIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: 'rgba(15,28,82,0.1)',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  backButtonText: {
    color: '#0f1c52',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  continueButton: {
    flex: 2,
    backgroundColor: '#0f1c52',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
});
