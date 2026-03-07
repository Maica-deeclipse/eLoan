/**
 * Personal Details Screen (Step 2)
 * Displays applicant's personal information (mostly read-only from profile)
 * Users must edit their profile in Settings to change contact/address/employment info
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
import { Ionicons } from '@expo/vector-icons';
import { useApplication } from '../../context/ApplicationContext';
import profileService from '../../services/profileService';
import { getLoanTypeDraft, saveLoanTypeDraft } from '../../utils/applicationDraftStorage';

export default function PersonalDetailsScreen({ navigation }) {
  const { state, setPersonalDetails, dispatch } = useApplication();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [redirectingToSettings, setRedirectingToSettings] = useState(false);

  // Form fields - Read-only fields (from profile)
  const [contactNumber, setContactNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [employerName, setEmployerName] = useState('');
  const [position, setPosition] = useState('');

  // Editable field
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
      // Pre-fill fields with existing data from profile
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

        // Only restore monthly income from draft (other fields are read-only from profile)
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
      Alert.alert(
        'Missing Information',
        'Contact number is required. Please update your profile in Settings.',
        [
          { text: 'Go to Settings', onPress: () => navigation.navigate('ProfileScreen') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return false;
    }
    if (!addressLine1.trim()) {
      Alert.alert(
        'Missing Information',
        'Address is required. Please update your profile in Settings.',
        [
          { text: 'Go to Settings', onPress: () => navigation.navigate('ProfileScreen') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return false;
    }
    if (!employerName.trim()) {
      Alert.alert(
        'Missing Information',
        'Office/Department is required. Please update your profile in Settings.',
        [
          { text: 'Go to Settings', onPress: () => navigation.navigate('ProfileScreen') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Only save monthly income (editable field)
      await profileService.updateProfile({
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

  const handleEditInSettings = () => {
    setRedirectingToSettings(true);
    // Short delay to show loading state, then redirect
    setTimeout(() => {
      navigation.navigate('ProfileScreen');
      setRedirectingToSettings(false);
    }, 500);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color="#02327a" />
        <Text style={styles.loadingText}>Loading your information...</Text>
      </SafeAreaView>
    );
  }

  if (redirectingToSettings) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['bottom']}>
        <ActivityIndicator size="large" color="#02327a" />
        <Text style={styles.loadingText}>Redirecting to Settings...</Text>
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
              Please verify your personal information below
            </Text>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color="#02327a" />
            <Text style={styles.infoBannerText}>
              Your contact, address, and employment details are pulled from your profile.{' '}
              <Text style={styles.infoBannerLink} onPress={handleEditInSettings}>
                Edit in Settings
              </Text>
            </Text>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Contact Information</Text>
              <TouchableOpacity onPress={handleEditInSettings} style={styles.editButton}>
                <Ionicons name="pencil" size={14} color="#02327a" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Contact Number</Text>
              <View style={styles.readOnlyInputContainer}>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={contactNumber}
                  placeholder="Not set"
                  editable={false}
                />
                <Ionicons name="lock-closed" size={16} color="#9ca3af" style={styles.lockIcon} />
              </View>
            </View>
          </View>

          {/* Address */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Address</Text>
              <TouchableOpacity onPress={handleEditInSettings} style={styles.editButton}>
                <Ionicons name="pencil" size={14} color="#02327a" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Street Address</Text>
              <View style={styles.readOnlyInputContainer}>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={addressLine1}
                  placeholder="Not set"
                  editable={false}
                />
                <Ionicons name="lock-closed" size={16} color="#9ca3af" style={styles.lockIcon} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={[styles.field, { flex: 1, marginRight: 8 }]}>
                <Text style={styles.label}>City</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={city}
                  placeholder="Not set"
                  editable={false}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={styles.label}>Province</Text>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={province}
                  placeholder="Not set"
                  editable={false}
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>ZIP Code</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled, { width: 120 }]}
                value={zipCode}
                placeholder="Not set"
                editable={false}
              />
            </View>
          </View>

          {/* Employment */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Employment Information</Text>
              <TouchableOpacity onPress={handleEditInSettings} style={styles.editButton}>
                <Ionicons name="pencil" size={14} color="#02327a" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Office/Department</Text>
              <View style={styles.readOnlyInputContainer}>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={employerName}
                  placeholder="Not set"
                  editable={false}
                />
                <Ionicons name="lock-closed" size={16} color="#9ca3af" style={styles.lockIcon} />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Position</Text>
              <View style={styles.readOnlyInputContainer}>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={position}
                  placeholder="Not set"
                  editable={false}
                />
                <Ionicons name="lock-closed" size={16} color="#9ca3af" style={styles.lockIcon} />
              </View>
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
              <Text style={styles.helperText}>You can update this for each application</Text>
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
    backgroundColor: '#02327a',
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
    marginBottom: 12,
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
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#e6eaf2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    marginLeft: 10,
    lineHeight: 18,
  },
  infoBannerLink: {
    color: '#02327a',
    fontWeight: '600',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#e6eaf2',
    borderRadius: 6,
  },
  editButtonText: {
    fontSize: 12,
    color: '#02327a',
    fontWeight: '600',
    marginLeft: 4,
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
  readOnlyInputContainer: {
    position: 'relative',
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
  inputDisabled: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    borderColor: '#e5e7eb',
  },
  lockIcon: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -8,
  },
  helperText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
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
    backgroundColor: '#02327a',
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
