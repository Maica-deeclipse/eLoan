import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SignatureScreen from 'react-native-signature-canvas';
import { useApplication } from '../../context/ApplicationContext';
import applicationService from '../../services/applicationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TERMS_VERSION = '1.0';

const TERMS_SECTIONS = [
  {
    title: 'Loan Agreement',
    content: `By signing this application, I acknowledge that I am applying for a loan from the Cooperative and agree to the following terms:

1. I certify that all information provided in this application is true, complete, and accurate.

2. I authorize the Cooperative to verify the information provided and to obtain credit reports and other information as necessary.

3. I understand that approval of this loan application is subject to the Cooperative's credit policies and procedures.`,
  },
  {
    title: 'Repayment Terms',
    content: `4. I agree to repay the loan according to the approved amortization schedule.

5. I understand that failure to make timely payments may result in additional charges, reporting to credit bureaus, and legal action.

6. I agree to notify the Cooperative immediately of any changes to my contact information or financial situation that may affect my ability to repay the loan.`,
  },
  {
    title: 'Co-Maker Agreement',
    content: `7. If co-makers are required for this loan, I understand that they will be jointly liable for the repayment of the loan.

8. I agree to ensure that my co-makers understand their obligations before they provide their consent.`,
  },
  {
    title: 'Data Privacy',
    content: `9. I consent to the collection, processing, and storage of my personal data in accordance with the Data Privacy Act of 2012.

10. I understand that my data will be used for loan processing, credit assessment, and related purposes.

11. I have the right to access, correct, and request deletion of my personal data subject to legal requirements.`,
  },
  {
    title: 'General Terms',
    content: `12. I understand that this electronic signature has the same legal effect as a handwritten signature.

13. I agree to be bound by the Cooperative's rules and regulations as amended from time to time.

14. I acknowledge that I have read and understood all the terms and conditions of this loan application.`,
  },
];

const ESignatureScreen = ({ navigation }) => {
  const { state, dispatch } = useApplication();
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasScrolledTerms, setHasScrolledTerms] = useState(false);
  const [signature, setSignature] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const signatureRef = useRef(null);

  useEffect(() => {
    // Check if e-signature is already done
    if (state.eSignature?.completed) {
      setSignature(state.eSignature.signature);
      setTermsAccepted(true);
    }
  }, []);

  const handleTermsScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    if (isCloseToBottom) {
      setHasScrolledTerms(true);
    }
  };

  const handleAcceptTerms = () => {
    if (!hasScrolledTerms) {
      Alert.alert(
        'Please Read Terms',
        'Please scroll through and read all the terms and conditions before accepting.'
      );
      return;
    }
    setTermsAccepted(true);
    setShowTermsModal(false);
  };

  const handleSignature = (signature) => {
    setSignature(signature);
    setShowSignaturePad(false);
  };

  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clearSignature();
    }
  };

  const handleContinue = async () => {
    if (!termsAccepted) {
      Alert.alert('Terms Required', 'Please read and accept the terms and conditions.');
      return;
    }

    if (!signature) {
      Alert.alert('Signature Required', 'Please provide your electronic signature.');
      return;
    }

    setLoading(true);
    try {
      // Convert base64 signature to file and upload
      const signatureData = {
        signature_data: signature,
        terms_accepted: true,
        terms_version: TERMS_VERSION,
      };

      await applicationService.uploadESignature(
        state.applicationId,
        signatureData.signature_data,
        signatureData.terms_accepted
      );

      dispatch({
        type: 'SET_ESIGNATURE',
        payload: { completed: true, signature },
      });

      dispatch({ type: 'SET_STEP', payload: 8 });
      navigation.navigate('ReviewSubmit');
    } catch (error) {
      console.error('E-signature error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to save signature');
    } finally {
      setLoading(false);
    }
  };

  const signatureStyle = `
    .m-signature-pad {
      box-shadow: none;
      border: none;
    }
    .m-signature-pad--body {
      border: none;
    }
    .m-signature-pad--footer {
      display: none;
    }
    body, html {
      background-color: #f8f9fa;
    }
  `;

  return (
    <View style={styles.container}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '87.5%' }]} />
        </View>
        <Text style={styles.progressText}>Step 7 of 8</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>E-Signature</Text>
        <Text style={styles.subtitle}>
          Please review the terms and conditions and provide your electronic signature to proceed.
        </Text>

        {/* Terms and Conditions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Terms & Conditions</Text>

          <TouchableOpacity
            style={[styles.termsCard, termsAccepted && styles.termsCardAccepted]}
            onPress={() => setShowTermsModal(true)}
          >
            <View style={styles.termsCardContent}>
              {termsAccepted ? (
                <Ionicons name="checkmark-circle" size={32} color="#28a745" />
              ) : (
                <Ionicons name="document-text" size={32} color="#0d6efd" />
              )}
              <View style={styles.termsCardText}>
                <Text style={styles.termsCardTitle}>
                  {termsAccepted ? 'Terms Accepted' : 'Read Terms & Conditions'}
                </Text>
                <Text style={styles.termsCardSubtitle}>
                  {termsAccepted
                    ? 'You have agreed to the loan terms'
                    : 'Tap to read the full agreement'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6c757d" />
          </TouchableOpacity>
        </View>

        {/* Signature Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Signature</Text>

          {signature ? (
            <View style={styles.signaturePreview}>
              <View style={styles.signatureImageContainer}>
                <SignatureScreen
                  ref={signatureRef}
                  dataURL={signature}
                  webStyle={signatureStyle}
                  style={styles.signatureImage}
                />
              </View>
              <View style={styles.signatureActions}>
                <TouchableOpacity
                  style={styles.clearSignatureButton}
                  onPress={() => {
                    setSignature(null);
                    dispatch({
                      type: 'SET_ESIGNATURE',
                      payload: { completed: false, signature: null },
                    });
                  }}
                >
                  <Ionicons name="refresh" size={18} color="#dc3545" />
                  <Text style={styles.clearSignatureText}>Clear & Redo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.signatureBox, !termsAccepted && styles.signatureBoxDisabled]}
              onPress={() => {
                if (!termsAccepted) {
                  Alert.alert(
                    'Accept Terms First',
                    'Please read and accept the terms before signing.'
                  );
                  return;
                }
                setShowSignaturePad(true);
              }}
            >
              <Ionicons
                name="pencil"
                size={48}
                color={termsAccepted ? '#0d6efd' : '#adb5bd'}
              />
              <Text
                style={[
                  styles.signatureBoxText,
                  !termsAccepted && styles.signatureBoxTextDisabled,
                ]}
              >
                Tap to sign
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={24} color="#0d6efd" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Legal Validity</Text>
            <Text style={styles.infoText}>
              Your electronic signature is legally binding under the Electronic Commerce Act. It
              carries the same weight as a handwritten signature.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={20} color="#666" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!termsAccepted || !signature) && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={loading || !termsAccepted || !signature}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Terms Modal */}
      <Modal
        visible={showTermsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Terms & Conditions</Text>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowTermsModal(false)}
            >
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.termsScrollView}
            onScroll={handleTermsScroll}
            scrollEventThrottle={400}
          >
            <Text style={styles.termsIntro}>
              LOAN APPLICATION AGREEMENT{'\n'}
              Version {TERMS_VERSION}
            </Text>

            {TERMS_SECTIONS.map((section, index) => (
              <View key={index} style={styles.termsSection}>
                <Text style={styles.termsSectionTitle}>{section.title}</Text>
                <Text style={styles.termsSectionContent}>{section.content}</Text>
              </View>
            ))}

            <View style={styles.termsFooter}>
              <Text style={styles.termsFooterText}>
                By accepting these terms, you acknowledge that you have read, understood, and
                agree to be bound by all the terms and conditions stated above.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.modalButtonContainer}>
            {!hasScrolledTerms && (
              <Text style={styles.scrollHint}>
                <Ionicons name="arrow-down" size={14} color="#6c757d" /> Scroll to read all terms
              </Text>
            )}
            <TouchableOpacity
              style={[
                styles.acceptButton,
                !hasScrolledTerms && styles.acceptButtonDisabled,
              ]}
              onPress={handleAcceptTerms}
              disabled={!hasScrolledTerms}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.acceptButtonText}>I Accept the Terms</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Signature Pad Modal */}
      <Modal
        visible={showSignaturePad}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowSignaturePad(false)}
      >
        <View style={styles.signaturePadContainer}>
          <View style={styles.signaturePadHeader}>
            <Text style={styles.signaturePadTitle}>Sign Here</Text>
            <TouchableOpacity
              style={styles.signaturePadClose}
              onPress={() => setShowSignaturePad(false)}
            >
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <Text style={styles.signaturePadInstructions}>
            Use your finger to draw your signature below
          </Text>

          <View style={styles.signatureCanvasContainer}>
            <SignatureScreen
              ref={signatureRef}
              onOK={handleSignature}
              onEmpty={() => Alert.alert('Empty Signature', 'Please provide your signature.')}
              descriptionText=""
              clearText="Clear"
              confirmText="Save"
              webStyle={`
                .m-signature-pad {
                  box-shadow: none;
                  border: 2px solid #0d6efd;
                  border-radius: 12px;
                }
                .m-signature-pad--body {
                  border: none;
                }
                .m-signature-pad--footer {
                  display: flex;
                  flex-direction: row;
                  justify-content: space-between;
                  padding: 16px;
                }
                .m-signature-pad--footer .button {
                  padding: 12px 24px;
                  border-radius: 8px;
                  font-size: 16px;
                  font-weight: 600;
                }
                .m-signature-pad--footer .button.clear {
                  background-color: #f8f9fa;
                  color: #dc3545;
                  border: 1px solid #dc3545;
                }
                .m-signature-pad--footer .button.save {
                  background-color: #0d6efd;
                  color: #fff;
                }
              `}
              style={styles.signatureCanvas}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e9ecef',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0d6efd',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 20,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 12,
  },
  termsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  termsCardAccepted: {
    borderColor: '#28a745',
    backgroundColor: '#f0fff4',
  },
  termsCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  termsCardText: {
    flex: 1,
    marginLeft: 12,
  },
  termsCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
  },
  termsCardSubtitle: {
    fontSize: 13,
    color: '#6c757d',
    marginTop: 2,
  },
  signatureBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0d6efd',
    borderStyle: 'dashed',
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signatureBoxDisabled: {
    borderColor: '#dee2e6',
    backgroundColor: '#f8f9fa',
  },
  signatureBoxText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0d6efd',
    marginTop: 12,
  },
  signatureBoxTextDisabled: {
    color: '#adb5bd',
  },
  signaturePreview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#28a745',
  },
  signatureImageContainer: {
    height: 150,
    backgroundColor: '#f8f9fa',
  },
  signatureImage: {
    flex: 1,
  },
  signatureActions: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    alignItems: 'center',
  },
  clearSignatureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  clearSignatureText: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e7f1ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0d6efd',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginRight: 12,
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 4,
  },
  continueButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d6efd',
    paddingVertical: 14,
    borderRadius: 12,
  },
  continueButtonDisabled: {
    backgroundColor: '#adb5bd',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  modalCloseButton: {
    padding: 4,
  },
  termsScrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  termsIntro: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    marginBottom: 16,
  },
  termsSection: {
    marginBottom: 20,
  },
  termsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0d6efd',
    marginBottom: 8,
  },
  termsSectionContent: {
    fontSize: 14,
    color: '#495057',
    lineHeight: 22,
  },
  termsFooter: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginVertical: 20,
  },
  termsFooterText: {
    fontSize: 14,
    color: '#495057',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  modalButtonContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  scrollHint: {
    fontSize: 13,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 12,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 16,
    borderRadius: 12,
  },
  acceptButtonDisabled: {
    backgroundColor: '#adb5bd',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Signature Pad Modal
  signaturePadContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  signaturePadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  signaturePadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212529',
  },
  signaturePadClose: {
    padding: 4,
  },
  signaturePadInstructions: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    paddingVertical: 16,
  },
  signatureCanvasContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  signatureCanvas: {
    flex: 1,
    borderRadius: 12,
  },
});

export default ESignatureScreen;
