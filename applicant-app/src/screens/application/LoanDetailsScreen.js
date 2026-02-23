/**
 * Loan Details Screen (Step 3)
 * Collects loan amount, term, and purpose with real-time amortization calculation
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
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

export default function LoanDetailsScreen({ navigation }) {
  const { state, setLoanDetails, dispatch, getNextStep } = useApplication();
  const { loanType, applicationId, coMakerRequirement, loanDetails: savedLoanDetails } = state;

  const [amount, setAmount] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [purpose, setPurpose] = useState('');
  const [calculation, setCalculation] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (savedLoanDetails) {
      setAmount(savedLoanDetails.amount ? String(savedLoanDetails.amount) : '');
      setTermMonths(savedLoanDetails.termMonths ? String(savedLoanDetails.termMonths) : '');
      setPurpose(savedLoanDetails.purpose || '');

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
        },
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [loanType?.id, applicationId, amount, termMonths, purpose]);

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
    setAmount(value);
    const error = validateAmount(value);
    setErrors((prev) => ({ ...prev, amount: error }));
    if (error) setCalculation(null);
  };

  const handleTermChange = (value) => {
    setTermMonths(value);
    const error = validateTerm(value);
    setErrors((prev) => ({ ...prev, term: error }));
    if (error) setCalculation(null);
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
      });

      // Update context
      setLoanDetails({
        amount,
        termMonths,
        purpose,
        calculatedAmortization: calculation?.monthly_amortization,
        calculatedTotal: calculation?.total_payable,
        calculatedInterest: calculation?.total_interest,
      });

      dispatch({ type: 'VALIDATE_LOAN_DETAILS', payload: true });

      // Navigate to next step
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
          },
        });
      }

      if (nextStep === 5) {
        navigation.navigate('DocumentUpload');
      } else {
        navigation.navigate('CoMaker');
      }
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
            <View style={styles.field}>
              <Text style={styles.label}>Loan Amount (₱) *</Text>
              <TextInput
                style={[styles.input, errors.amount && styles.inputError]}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="Enter amount"
                keyboardType="numeric"
              />
              {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Term (Months) *</Text>
              <TextInput
                style={[styles.input, errors.term && styles.inputError]}
                value={termMonths}
                onChangeText={handleTermChange}
                placeholder="Enter term in months"
                keyboardType="numeric"
              />
              {errors.term && <Text style={styles.errorText}>{errors.term}</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Purpose of Loan *</Text>
              <TextInput
                style={[styles.input, styles.textArea, errors.purpose && styles.inputError]}
                value={purpose}
                onChangeText={setPurpose}
                placeholder="Describe the purpose of this loan"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              {errors.purpose && <Text style={styles.errorText}>{errors.purpose}</Text>}
            </View>
          </View>

          {/* Amortization Calculator */}
          {(calculation || calculating) && (
            <View style={styles.calculationCard}>
              <Text style={styles.calculationTitle}>Loan Calculation</Text>
              {calculating ? (
                <ActivityIndicator color="#6366f1" />
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
    backgroundColor: '#f9fafb',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  progressContainer: {
    padding: 16,
    paddingBottom: 0,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
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
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  loanTypeName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  loanTypeDetails: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  loanTypeInfo: {
    fontSize: 13,
    color: '#c7d2fe',
    marginRight: 16,
  },
  loanTypeRange: {
    fontSize: 12,
    color: '#e0e7ff',
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
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f2937',
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
    color: '#6366f1',
    marginTop: 8,
  },
  calculationCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  calculationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 12,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  calcLabel: {
    fontSize: 14,
    color: '#166534',
  },
  calcValue: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '500',
  },
  calcValueMain: {
    fontSize: 18,
    color: '#166534',
    fontWeight: '700',
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
    borderTopColor: '#e5e7eb',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  backButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    flex: 2,
    backgroundColor: '#6366f1',
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
    fontWeight: '600',
  },
});
