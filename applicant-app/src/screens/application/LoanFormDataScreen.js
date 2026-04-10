/**
 * Loan Form Data Screen (Extra Step — between LoanDetails and CoMaker/DocumentUpload)
 *
 * Dynamically renders loan-type-specific fields driven by loanTypeConfig.
 * Only shown for loan types where hasExtraStep === true (ATM, Gadget, LAD, Emergency).
 * Saves data to LoanApplication.loan_form_data on the backend via step 4.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApplication } from '../../context/ApplicationContext';
import applicationService from '../../services/applicationService';
import { getLoanTypeConfig } from '../../config/loanTypeConfig';
import { getLoanTypeDraft, saveLoanTypeDraft } from '../../utils/applicationDraftStorage';

export default function LoanFormDataScreen({ navigation }) {
  const {
    state,
    setLoanFormData,
    dispatch,
    getPostLoanFormDataRoute,
  } = useApplication();

  const { loanType, applicationId, loanFormData: savedFormData } = state;
  const config = getLoanTypeConfig(loanType?.loan_name);
  const extraFields = config.extraFields || [];

  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Restore from context state
  useEffect(() => {
    if (savedFormData && Object.keys(savedFormData).length > 0) {
      setValues(savedFormData);
    }
  }, []);

  // Restore from local draft
  useEffect(() => {
    const loadDraft = async () => {
      if (!loanType?.id || !applicationId) return;
      const draft = await getLoanTypeDraft(loanType.id);
      if (draft?.applicationId !== applicationId || !draft.loanFormData) return;
      setValues((prev) => ({ ...draft.loanFormData, ...prev }));
    };
    loadDraft();
  }, [loanType?.id, applicationId]);

  const handleChange = (key, raw) => {
    setValues((prev) => ({ ...prev, [key]: raw }));
    setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const formatCurrencyDisplay = (value) => {
    if (!value && value !== 0) return '';
    const num = parseFloat(String(value).replace(/,/g, ''));
    if (isNaN(num)) return String(value);
    return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const validate = useCallback(() => {
    const newErrors = {};
    for (const field of extraFields) {
      if (field.required) {
        const val = values[field.key];
        if (!val || String(val).trim() === '' || String(val).trim() === '0') {
          newErrors[field.key] = `${field.label} is required`;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [extraFields, values]);

  const handleContinue = async () => {
    if (!validate()) {
      Alert.alert('Validation Error', 'Please fill in all required fields.');
      return;
    }

    setSaving(true);
    try {
      // Save to backend — step 4 merges loan_form_data on the server
      await applicationService.updateStep(applicationId, 4, { loan_form_data: values });

      // Update context
      setLoanFormData(values);

      // Persist to draft storage
      if (loanType?.id) {
        await saveLoanTypeDraft(loanType.id, {
          applicationId,
          loanFormData: values,
        });
      }

      const nextRoute = getPostLoanFormDataRoute();
      if (nextRoute === 'CoMaker') {
        dispatch({ type: 'SET_CURRENT_STEP', payload: 4 });
      } else {
        dispatch({ type: 'SET_CURRENT_STEP', payload: 5 });
      }
      navigation.navigate(nextRoute);
    } catch (error) {
      console.error('Save loan form data error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save details');
    } finally {
      setSaving(false);
    }
  };

  if (!loanType) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top', 'bottom']}>
        <Text style={styles.errorText}>Loan type not selected</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '43.75%' }]} />
          </View>
          <Text style={styles.progressText}>Step 4 of 8</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.headerCard}>
            <Text style={styles.headerTitle}>{config.extraStepTitle}</Text>
            <Text style={styles.headerSubtitle}>{loanType.loan_name}</Text>
          </View>

          {/* Fields */}
          <View style={styles.section}>
            {extraFields.map((field) => (
              <View key={field.key} style={styles.fieldGroup}>
                <Text style={styles.label}>
                  {field.label}
                  {field.required ? ' *' : ' (optional)'}
                </Text>

                {field.type === 'currency' ? (
                  <View style={[styles.currencyRow, errors[field.key] && styles.inputError]}>
                    <Text style={styles.currencyPrefix}>₱</Text>
                    <TextInput
                      style={styles.currencyInput}
                      value={values[field.key] ? String(values[field.key]) : ''}
                      onChangeText={(t) => handleChange(field.key, t.replace(/[^0-9.]/g, ''))}
                      onBlur={() => {
                        const num = parseFloat(values[field.key]);
                        if (!isNaN(num)) {
                          handleChange(field.key, String(num));
                        }
                      }}
                      placeholder={field.placeholder || '0.00'}
                      placeholderTextColor="#9ca3af"
                      keyboardType="decimal-pad"
                    />
                  </View>
                ) : (
                  <TextInput
                    style={[styles.input, errors[field.key] && styles.inputError]}
                    value={values[field.key] || ''}
                    onChangeText={(t) => handleChange(field.key, t)}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="words"
                  />
                )}

                {errors[field.key] ? (
                  <Text style={styles.errorText}>{errors[field.key]}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.continueButton, saving && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={saving}
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
    backgroundColor: '#e5e7eb',
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
  headerCard: {
    backgroundColor: '#0f1c52',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Poppins_700Bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#c7d2fe',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 6,
    fontFamily: 'Poppins_500Medium',
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
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  currencyPrefix: {
    fontSize: 15,
    color: '#6b7280',
    marginRight: 6,
  },
  currencyInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1f2937',
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
    backgroundColor: '#EEF4FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginRight: 8,
  },
  backButtonText: {
    color: '#374151',
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
