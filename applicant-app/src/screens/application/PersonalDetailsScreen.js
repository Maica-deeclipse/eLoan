/**
 * Personal Details Screen (Step 2)
 * Collects applicant's personal information
 */

import React, { useState, useEffect } from 'react';
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
import profileService from '../../services/profileService';
import { getLoanTypeDraft, saveLoanTypeDraft } from '../../utils/applicationDraftStorage';

export default function PersonalDetailsScreen({ navigation }) {
  const { state, setPersonalDetails, dispatch } = useApplication();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [contactNumber, setContactNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [employerName, setEmployerName] = useState('');
  const [position, setPosition] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');

  useEffect(() => {
    loadAutofillData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!state.loanType?.id || !state.applicationId) return;

      saveLoanTypeDraft(state.loanType.id, {
        applicationId: state.applicationId,
        currentStep: 2,
        personalDetails: {
          contactNumber,
          addressLine1,
          city,
          province,
          zipCode,
          employerName,
          position,
          monthlyIncome,
        },
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [
    state.loanType?.id,
    state.applicationId,
    contactNumber,
    addressLine1,
    city,
    province,
    zipCode,
    employerName,
    position,
    monthlyIncome,
  ]);

  const loadAutofillData = async () => {
    try {
      const data = await profileService.getAutofillData();
      // Pre-fill fields with existing data
      setContactNumber(data.contact_number || '');
      setAddressLine1(data.address_line1 || '');
      setCity(data.city || '');
      setProvince(data.province || '');
      setZipCode(data.zip_code || '');
      setEmployerName(data.employer_name || '');
      setPosition(data.position || '');
      setMonthlyIncome(data.monthly_income || '');

      if (state.loanType?.id && state.applicationId) {
        const localDraft = await getLoanTypeDraft(state.loanType.id);
        const localPersonalDetails =
          localDraft?.applicationId === state.applicationId
            ? localDraft.personalDetails || {}
            : {};

        setContactNumber(localPersonalDetails.contactNumber ?? data.contact_number ?? '');
        setAddressLine1(localPersonalDetails.addressLine1 ?? data.address_line1 ?? '');
        setCity(localPersonalDetails.city ?? data.city ?? '');
        setProvince(localPersonalDetails.province ?? data.province ?? '');
        setZipCode(localPersonalDetails.zipCode ?? data.zip_code ?? '');
        setEmployerName(localPersonalDetails.employerName ?? data.employer_name ?? '');
        setPosition(localPersonalDetails.position ?? data.position ?? '');
        setMonthlyIncome(localPersonalDetails.monthlyIncome ?? data.monthly_income ?? '');
      }
    } catch (error) {
      console.error('Load autofill error:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!contactNumber.trim()) {
      Alert.alert('Validation Error', 'Contact number is required');
      return false;
    }
    if (!addressLine1.trim()) {
      Alert.alert('Validation Error', 'Address is required');
      return false;
    }
    if (!employerName.trim()) {
      Alert.alert('Validation Error', 'Office is required');
      return false;
    }
    if (!monthlyIncome || isNaN(parseFloat(monthlyIncome)) || parseFloat(monthlyIncome) <= 0) {
      Alert.alert('Validation Error', 'Monthly income is required');
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Save to profile
      await profileService.updateProfile({
        contact_number: contactNumber,
        address_line1: addressLine1,
        city: city,
        province: province,
        zip_code: zipCode,
        employer_name: employerName,
        position: position,
        monthly_income: monthlyIncome || null,
      });

      // Update context
      setPersonalDetails({
        contactNumber,
        addressLine1,
        city,
        province,
        zipCode,
        employerName,
        position,
        monthlyIncome,
      });

      dispatch({ type: 'VALIDATE_PERSONAL_DETAILS', payload: true });
      dispatch({ type: 'SET_CURRENT_STEP', payload: 3 });

      if (state.loanType?.id && state.applicationId) {
        await saveLoanTypeDraft(state.loanType.id, {
          applicationId: state.applicationId,
          currentStep: 3,
          personalDetails: {
            contactNumber,
            addressLine1,
            city,
            province,
            zipCode,
            employerName,
            position,
            monthlyIncome,
          },
        });
      }

      navigation.navigate('LoanDetails');
    } catch (error) {
      console.error('Save profile error:', error);
      Alert.alert('Error', 'Failed to save personal details');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading your information...</Text>
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
            <View style={[styles.progressFill, { width: '25%' }]} />
          </View>
          <Text style={styles.progressText}>Step 2 of 8</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Instructions */}
          <View style={styles.instructions}>
            <Text style={styles.instructionTitle}>Personal Details</Text>
            <Text style={styles.instructionText}>
              Please verify and complete your personal information
            </Text>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Contact Number *</Text>
              <TextInput
                style={styles.input}
                value={contactNumber}
                onChangeText={setContactNumber}
                placeholder="09XX XXX XXXX"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Address</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Street Address *</Text>
              <TextInput
                style={styles.input}
                value={addressLine1}
                onChangeText={setAddressLine1}
                placeholder="House/Unit No., Street, Barangay"
              />
            </View>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="City"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Province</Text>
                <TextInput
                  style={styles.input}
                  value={province}
                  onChangeText={setProvince}
                  placeholder="Province"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>ZIP Code</Text>
              <TextInput
                style={[styles.input, { width: 120 }]}
                value={zipCode}
                onChangeText={setZipCode}
                placeholder="ZIP"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Employment */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Employment Information</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Office *</Text>
              <TextInput
                style={styles.input}
                value={employerName}
                onChangeText={setEmployerName}
                placeholder="Office/Department Name"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Position</Text>
              <TextInput
                style={styles.input}
                value={position}
                onChangeText={setPosition}
                placeholder="Your Position/Title"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Monthly Income</Text>
              <TextInput
                style={styles.input}
                value={monthlyIncome}
                onChangeText={setMonthlyIncome}
                placeholder="₱0.00"
                keyboardType="numeric"
              />
            </View>
          </View>
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
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
  instructions: {
    marginBottom: 16,
  },
  instructionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  instructionText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
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
  row: {
    flexDirection: 'row',
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
