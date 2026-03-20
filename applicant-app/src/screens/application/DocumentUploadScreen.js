import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useApplication } from '../../context/ApplicationContext';
import applicationService from '../../services/applicationService';

const REQUIRED_DOCUMENTS = [
  {
    key: 'buksu_id',
    label: 'BukSu ID (Front)',
    description: 'Front side of your BukSU ID showing your photo',
    required: true,
    acceptedTypes: ['image'],
  },
  {
    key: 'proof_of_income',
    label: 'Proof of Income',
    description: 'e.g., Pay slip, ITR, Certificate of Employment',
    required: true,
    acceptedTypes: ['image', 'pdf'],
  },
  {
    key: 'membership_certificate',
    label: 'Cooperative Membership Certificate',
    description: 'Your cooperative membership proof',
    required: true,
    acceptedTypes: ['image', 'pdf'],
  },
  {
    key: 'other_documents',
    label: 'Other Supporting Documents',
    description: 'Any additional documents (optional)',
    required: false,
    acceptedTypes: ['image', 'pdf'],
    multiple: true,
  },
];

const DocumentUploadScreen = ({ navigation }) => {
  const { state, dispatch } = useApplication();
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState({});
  const [uploading, setUploading] = useState(null);

  useEffect(() => {
    // Initialize from state if available
    if (state.documents) {
      setDocuments(state.documents);
    }
    loadExistingDocuments();
  }, []);

  const loadExistingDocuments = async () => {
    try {
      const response = await applicationService.getDocuments(state.applicationId);
      if (response.documents && response.documents.length > 0) {
        const docsMap = {};
        response.documents.forEach((doc) => {
          if (doc.document_type === 'other_documents') {
            if (!docsMap[doc.document_type]) {
              docsMap[doc.document_type] = [];
            }
            docsMap[doc.document_type].push({
              id: doc.id,
              uri: doc.file_path,
              name: doc.document_name,
              uploaded: true,
            });
          } else {
            docsMap[doc.document_type] = {
              id: doc.id,
              uri: doc.file_path,
              name: doc.document_name,
              uploaded: true,
            };
          }
        });
        setDocuments(docsMap);
        dispatch({ type: 'SET_DOCUMENTS', payload: docsMap });
      }
    } catch (error) {
      console.error('Load documents error:', error);
    }
  };

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant access to your photo library to upload documents.'
      );
      return false;
    }
    return true;
  };

  const pickImage = async (documentKey) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadDocument(documentKey, result.assets[0]);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async (documentKey) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please grant camera access to take photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadDocument(documentKey, result.assets[0]);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickDocument = async (documentKey) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.type !== 'cancel' && result.assets && result.assets[0]) {
        await uploadDocument(documentKey, result.assets[0]);
      }
    } catch (error) {
      console.error('Document picker error:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadDocument = async (documentKey, file) => {
    setUploading(documentKey);
    try {
      const response = await applicationService.uploadDocument(
        state.applicationId,
        documentKey,
        file.uri
      );

      const docInfo = {
        id: response.id,
        uri: file.uri,
        name: file.fileName || file.name,
        uploaded: true,
      };

      let updatedDocs;
      if (documentKey === 'other_documents') {
        const otherDocs = documents[documentKey] || [];
        updatedDocs = {
          ...documents,
          [documentKey]: [...otherDocs, docInfo],
        };
      } else {
        updatedDocs = {
          ...documents,
          [documentKey]: docInfo,
        };
      }

      setDocuments(updatedDocs);
      dispatch({ type: 'SET_DOCUMENTS', payload: updatedDocs });
      Alert.alert('Success', 'Document uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(null);
    }
  };

  const removeDocument = async (documentKey, index = null) => {
    const docInfo = index !== null ? documents[documentKey][index] : documents[documentKey];

    Alert.alert('Remove Document', 'Are you sure you want to remove this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            if (docInfo.uploaded && docInfo.id) {
              await applicationService.deleteDocument(docInfo.id);
            }

            let updatedDocs;
            if (index !== null) {
              const otherDocs = [...documents[documentKey]];
              otherDocs.splice(index, 1);
              updatedDocs = {
                ...documents,
                [documentKey]: otherDocs,
              };
            } else {
              updatedDocs = { ...documents };
              delete updatedDocs[documentKey];
            }

            setDocuments(updatedDocs);
            dispatch({ type: 'SET_DOCUMENTS', payload: updatedDocs });
          } catch (error) {
            console.error('Delete error:', error);
            Alert.alert('Error', 'Failed to remove document');
          }
        },
      },
    ]);
  };

  const showUploadOptions = (docConfig) => {
    const options = [
      { text: 'Take Photo', onPress: () => takePhoto(docConfig.key) },
      { text: 'Choose from Gallery', onPress: () => pickImage(docConfig.key) },
    ];

    if (docConfig.acceptedTypes.includes('pdf')) {
      options.push({ text: 'Choose PDF', onPress: () => pickDocument(docConfig.key) });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Upload Document', `How would you like to add ${docConfig.label}?`, options);
  };

  const isDocumentUploaded = (key) => {
    if (key === 'other_documents') {
      return documents[key] && documents[key].length > 0;
    }
    return documents[key] && documents[key].uploaded;
  };

  const getUploadedCount = () => {
    return REQUIRED_DOCUMENTS.filter((doc) => doc.required && isDocumentUploaded(doc.key)).length;
  };

  const getRequiredCount = () => {
    return REQUIRED_DOCUMENTS.filter((doc) => doc.required).length;
  };

  const allRequiredUploaded = () => {
    return REQUIRED_DOCUMENTS.filter((doc) => doc.required).every((doc) =>
      isDocumentUploaded(doc.key)
    );
  };

  const handleContinue = () => {
    if (!allRequiredUploaded()) {
      Alert.alert(
        'Required Documents',
        'Please upload all required documents before continuing.'
      );
      return;
    }

    dispatch({ type: 'SET_STEP', payload: 6 });
    navigation.navigate('FaceVerification');
  };

  const renderDocumentItem = (docConfig) => {
    const isUploaded = isDocumentUploaded(docConfig.key);
    const isMultiple = docConfig.multiple;
    const docData = documents[docConfig.key];

    return (
      <View key={docConfig.key} style={styles.documentCard}>
        <View style={styles.documentHeader}>
          <View style={styles.documentInfo}>
            <View style={styles.documentTitleRow}>
              <Text style={styles.documentLabel}>{docConfig.label}</Text>
              {docConfig.required ? (
                <View style={styles.requiredBadge}>
                  <Text style={styles.requiredText}>Required</Text>
                </View>
              ) : (
                <View style={styles.optionalBadge}>
                  <Text style={styles.optionalText}>Optional</Text>
                </View>
              )}
            </View>
            <Text style={styles.documentDescription}>{docConfig.description}</Text>
          </View>
          {isUploaded && !isMultiple && (
            <Ionicons name="checkmark-circle" size={28} color="#28a745" />
          )}
        </View>

        {/* Show uploaded document(s) */}
        {isMultiple && docData && docData.length > 0 ? (
          <View style={styles.uploadedList}>
            {docData.map((doc, index) => (
              <View key={index} style={styles.uploadedItem}>
                <View style={styles.uploadedItemInfo}>
                  {doc.uri && doc.uri.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                    <Image source={{ uri: doc.uri }} style={styles.uploadedThumbnail} />
                  ) : (
                    <View style={styles.pdfIcon}>
                      <Ionicons name="document" size={24} color="#dc3545" />
                    </View>
                  )}
                  <Text style={styles.uploadedFileName} numberOfLines={1}>
                    {doc.name || 'Document'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.removeDocButton}
                  onPress={() => removeDocument(docConfig.key, index)}
                >
                  <Ionicons name="trash-outline" size={20} color="#dc3545" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : !isMultiple && docData ? (
          <View style={styles.uploadedSingle}>
            {docData.uri && docData.uri.match(/\.(jpg|jpeg|png|gif)$/i) ? (
              <Image source={{ uri: docData.uri }} style={styles.uploadedImage} />
            ) : (
              <View style={styles.pdfPreview}>
                <Ionicons name="document" size={40} color="#dc3545" />
                <Text style={styles.pdfText}>PDF Document</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.changeSingleButton}
              onPress={() => showUploadOptions(docConfig)}
            >
              <Ionicons name="camera" size={18} color="#0d6efd" />
              <Text style={styles.changeSingleText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeSingleButton}
              onPress={() => removeDocument(docConfig.key)}
            >
              <Ionicons name="trash-outline" size={18} color="#dc3545" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Upload button */}
        {uploading === docConfig.key ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="small" color="#0d6efd" />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        ) : (
          (!isUploaded || isMultiple) && (
            <TouchableOpacity
              style={[styles.uploadButton, isUploaded && styles.uploadButtonSmall]}
              onPress={() => showUploadOptions(docConfig)}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#0d6efd" />
              <Text style={styles.uploadButtonText}>
                {isMultiple && isUploaded ? 'Add Another' : 'Upload'}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '62.5%' }]} />
        </View>
        <Text style={styles.progressText}>Step 5 of 8</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Upload Documents</Text>
        <Text style={styles.subtitle}>
          Please upload clear copies of the required documents. Accepted formats: JPG, PNG, PDF.
        </Text>

        {/* Upload Progress */}
        <View style={styles.uploadProgress}>
          <View style={styles.uploadProgressInfo}>
            <Ionicons name="documents" size={24} color="#0d6efd" />
            <Text style={styles.uploadProgressText}>
              {getUploadedCount()} of {getRequiredCount()} required documents uploaded
            </Text>
          </View>
          <View style={styles.uploadProgressBar}>
            <View
              style={[
                styles.uploadProgressFill,
                { width: `${(getUploadedCount() / getRequiredCount()) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Document List */}
        {REQUIRED_DOCUMENTS.map(renderDocumentItem)}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Ionicons name="shield-checkmark" size={24} color="#28a745" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Document Security</Text>
            <Text style={styles.infoText}>
              Your documents are securely stored and encrypted. They will only be used for loan
              processing and verification purposes.
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
            !allRequiredUploaded() && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={loading || !allRequiredUploaded()}
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
    marginBottom: 20,
  },
  uploadProgress: {
    backgroundColor: '#e7f1ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  uploadProgressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadProgressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0d6efd',
    marginLeft: 12,
  },
  uploadProgressBar: {
    height: 8,
    backgroundColor: '#c7deff',
    borderRadius: 4,
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: '#0d6efd',
    borderRadius: 4,
  },
  documentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  documentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  documentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginRight: 8,
  },
  requiredBadge: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  requiredText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#dc2626',
  },
  optionalBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  optionalText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
  },
  documentDescription: {
    fontSize: 13,
    color: '#6c757d',
    lineHeight: 18,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0d6efd',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    backgroundColor: '#f8faff',
  },
  uploadButtonSmall: {
    paddingVertical: 10,
    marginTop: 12,
  },
  uploadButtonText: {
    color: '#0d6efd',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  uploadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  uploadingText: {
    color: '#0d6efd',
    fontSize: 14,
    marginLeft: 8,
  },
  uploadedSingle: {
    position: 'relative',
    marginBottom: 8,
  },
  uploadedImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
  },
  pdfPreview: {
    width: '100%',
    height: 100,
    borderRadius: 10,
    backgroundColor: '#fff5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
  },
  changeSingleButton: {
    position: 'absolute',
    top: 8,
    right: 48,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  changeSingleText: {
    color: '#0d6efd',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  removeSingleButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  uploadedList: {
    marginBottom: 8,
  },
  uploadedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  uploadedItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  uploadedThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
  },
  pdfIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#fff5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  uploadedFileName: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
  },
  removeDocButton: {
    padding: 8,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#d4edda',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    marginTop: 8,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28a745',
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
});

export default DocumentUploadScreen;
