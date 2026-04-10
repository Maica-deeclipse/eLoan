/**
 * Application Detail Screen
 * Shows detailed information about a loan application
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import applicationService from '../services/applicationService';
import { clearLoanTypeDraft } from '../utils/applicationDraftStorage';

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
    'Withdrawn': '#6b7280',
  };
  return colors[status] || '#6b7280';
};

const InfoRow = ({ label, value, highlight = false }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>{value}</Text>
  </View>
);

const SectionCard = ({ title, children }) => (
  <View style={styles.sectionCard}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

export default function ApplicationDetailScreen({ route, navigation }) {
  const { id } = route.params;
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    loadApplication();
  }, [id]);

  const loadApplication = async () => {
    try {
      const data = await applicationService.getApplication(id);
      setApplication(data);
    } catch (error) {
      console.error('Load application error:', error);
      Alert.alert('Error', 'Failed to load application details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = () => {
    Alert.alert(
      'Withdraw Application',
      'Are you sure you want to withdraw this application? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            setWithdrawing(true);
            try {
              await applicationService.withdrawApplication(id);
              Alert.alert('Success', 'Application withdrawn successfully');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to withdraw application');
              setWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteDraft = () => {
    Alert.alert(
      'Delete Draft',
      'Are you sure you want to delete this draft? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setWithdrawing(true);
            try {
              await applicationService.deleteDraftApplication(id);

              if (application.loan_type?.id) {
                await clearLoanTypeDraft(application.loan_type.id);
              }

              Alert.alert('Success', 'Draft deleted successfully');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', error.response?.data?.error || 'Failed to delete draft');
              setWithdrawing(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading application...</Text>
      </SafeAreaView>
    );
  }

  if (!application) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>Application not found</Text>
      </SafeAreaView>
    );
  }

  const canWithdraw = application.status === 'Submitted';
  const canDeleteDraft = application.status === 'Draft';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: getStatusColor(application.status) }]}>
          <Text style={styles.statusBannerText}>{application.status}</Text>
        </View>

        {/* Loan Type Card */}
        <SectionCard title="Loan Information">
          <InfoRow label="Loan Type" value={application.loan_type.loan_name} />
          <InfoRow label="Application ID" value={`#${application.id}`} />
          <InfoRow
            label="Applied On"
            value={new Date(application.application_date).toLocaleDateString()}
          />
        </SectionCard>

        {/* Amount Details */}
        <SectionCard title="Amount Details">
          <InfoRow
            label="Amount Requested"
            value={`₱${parseFloat(application.amount_requested).toLocaleString()}`}
            highlight
          />
          <InfoRow label="Term" value={`${application.term_months} months`} />
          <InfoRow
            label="Interest Rate"
            value={`${application.loan_type.interest_rate}%`}
          />
          <InfoRow
            label="Monthly Payment"
            value={`₱${parseFloat(application.monthly_amortization).toLocaleString()}`}
            highlight
          />
          <InfoRow
            label="Total Payable"
            value={`₱${parseFloat(application.total_payable).toLocaleString()}`}
          />
        </SectionCard>

        {/* Payment Status (if disbursed) */}
        {['Disbursed', 'Approved by Credit Committee'].includes(application.status) && (
          <SectionCard title="Payment Status">
            <InfoRow
              label="Total Paid"
              value={`₱${parseFloat(application.total_paid).toLocaleString()}`}
            />
            <InfoRow
              label="Remaining Balance"
              value={`₱${parseFloat(application.remaining_balance).toLocaleString()}`}
              highlight
            />
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(100, (parseFloat(application.total_paid) / parseFloat(application.total_payable)) * 100)}%`
                    }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round((parseFloat(application.total_paid) / parseFloat(application.total_payable)) * 100)}% paid
              </Text>
            </View>
          </SectionCard>
        )}

        {/* Purpose */}
        <SectionCard title="Loan Purpose">
          <Text style={styles.purposeText}>{application.purpose || 'Not specified'}</Text>
        </SectionCard>

        {/* Co-Makers */}
        {application.comakers && application.comakers.length > 0 && (
          <SectionCard title="Co-Makers">
            {application.comakers.map((comaker, index) => (
              <View key={comaker.id} style={styles.comakerItem}>
                <Text style={styles.comakerName}>{comaker.user_name}</Text>
                <Text style={styles.comakerEmail}>{comaker.user_email}</Text>
                {comaker.info?.relationship && (
                  <Text style={styles.comakerRelation}>
                    Relationship: {comaker.info.relationship}
                  </Text>
                )}
              </View>
            ))}
          </SectionCard>
        )}

        {/* Documents */}
        {application.documents && application.documents.length > 0 && (
          <SectionCard title="Documents">
            {application.documents.map((doc) => (
              <View key={doc.id} style={styles.documentItem}>
                <View style={styles.documentInfo}>
                  <Text style={styles.documentType}>{doc.document_name}</Text>
                  <Text style={styles.documentDate}>
                    Uploaded: {new Date(doc.uploaded_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={[
                  styles.verifiedBadge,
                  { backgroundColor: doc.verified ? '#d1fae5' : '#fef3c7' }
                ]}>
                  <Text style={[
                    styles.verifiedText,
                    { color: doc.verified ? '#059669' : '#d97706' }
                  ]}>
                    {doc.verified ? 'Verified' : 'Pending'}
                  </Text>
                </View>
              </View>
            ))}
          </SectionCard>
        )}

        {/* Verification Status */}
        <SectionCard title="Verification">
          <View style={styles.verificationRow}>
            <Text style={styles.verificationLabel}>Face Capture</Text>
            <Text style={[
              styles.verificationStatus,
              { color: application.face_verification?.verified ? '#059669' : '#9ca3af' }
            ]}>
              {application.face_verification?.completed ? (application.face_verification?.verified ? 'Verified' : 'Pending') : 'Not Done'}
            </Text>
          </View>
          <View style={styles.verificationRow}>
            <Text style={styles.verificationLabel}>Liveness Check</Text>
            <Text style={[
              styles.verificationStatus,
              { color: application.liveness_check?.verified ? '#059669' : '#9ca3af' }
            ]}>
              {application.liveness_check?.completed ? (application.liveness_check?.verified ? 'Verified' : 'Pending') : 'Not Done'}
            </Text>
          </View>
        </SectionCard>

        {/* Actions */}
        {canWithdraw && (
          <TouchableOpacity
            style={[styles.withdrawButton, withdrawing && styles.withdrawButtonDisabled]}
            onPress={handleWithdraw}
            disabled={withdrawing}
          >
            {withdrawing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.withdrawButtonText}>Withdraw Application</Text>
            )}
          </TouchableOpacity>
        )}
        {canDeleteDraft && (
          <>
            <TouchableOpacity
              style={[styles.primaryButton, withdrawing && styles.withdrawButtonDisabled]}
              onPress={() =>
                navigation.navigate('ApplicationWizard', {
                  screen: 'SelectLoanType',
                  params: {
                    resumeLoanTypeId: application.loan_type?.id,
                    resumeApplicationId: application.id,
                  },
                })
              }
              disabled={withdrawing}
            >
              <Text style={styles.withdrawButtonText}>Resume Application</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteButton, withdrawing && styles.withdrawButtonDisabled]}
              onPress={handleDeleteDraft}
              disabled={withdrawing}
            >
              {withdrawing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.withdrawButtonText}>Delete Draft</Text>
              )}
            </TouchableOpacity>
          </>
        )}
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
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  statusBanner: {
    padding: 16,
    alignItems: 'center',
  },
  statusBannerText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  sectionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#6b7280',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontFamily: 'Poppins_500Medium',
  },
  infoValueHighlight: {
    color: '#6366f1',
    fontFamily: 'Poppins_600SemiBold',
  },
  purposeText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'right',
  },
  comakerItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  comakerName: {
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
    color: '#1f2937',
  },
  comakerEmail: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  comakerRelation: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  documentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  documentInfo: {
    flex: 1,
  },
  documentType: {
    fontSize: 14,
    color: '#1f2937',
  },
  documentDate: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  verifiedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
  },
  verificationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  verificationLabel: {
    fontSize: 14,
    color: '#374151',
  },
  verificationStatus: {
    fontSize: 14,
    fontFamily: 'Poppins_500Medium',
  },
  withdrawButton: {
    backgroundColor: '#ef4444',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#6b7280',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  withdrawButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  withdrawButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
});
