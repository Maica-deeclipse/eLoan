/**
 * OCR Results Modal Component
 *
 * Displays OCR scan results from ID scanning with:
 * - ID type badge (Driver's License, UMID, Passport)
 * - Extracted fields with editable inputs
 * - Confidence score indicators per field
 * - Overall confidence percentage
 * - Confirm/Rescan buttons
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

const ID_TYPE_LABELS = {
  drivers_license: "Driver's License",
  umid: 'UMID',
  passport: 'Passport',
  unknown: 'Unknown ID',
};

const ID_TYPE_COLORS = {
  drivers_license: '#2196F3',
  umid: '#4CAF50',
  passport: '#9C27B0',
  unknown: '#757575',
};

const getConfidenceColor = (score) => {
  if (score >= 0.8) return '#4CAF50'; // Green
  if (score >= 0.6) return '#FF9800'; // Orange
  return '#F44336'; // Red
};

const getConfidenceLabel = (score) => {
  if (score >= 0.8) return 'High';
  if (score >= 0.6) return 'Medium';
  return 'Low';
};

const ConfidenceBar = ({ score, label }) => {
  const color = getConfidenceColor(score);
  const percentage = Math.round(score * 100);

  return (
    <View style={styles.confidenceContainer}>
      <Text style={styles.confidenceLabel}>{label}</Text>
      <View style={styles.confidenceBarOuter}>
        <View
          style={[
            styles.confidenceBarInner,
            { width: `${percentage}%`, backgroundColor: color },
          ]}
        />
      </View>
      <Text style={[styles.confidenceText, { color }]}>{percentage}%</Text>
    </View>
  );
};

const FieldInput = ({ label, value, confidence, onChange, editable = true }) => {
  const confidenceColor = getConfidenceColor(confidence);

  return (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {confidence > 0 && (
          <View style={[styles.confidenceBadge, { backgroundColor: confidenceColor }]}>
            <Text style={styles.confidenceBadgeText}>
              {Math.round(confidence * 100)}%
            </Text>
          </View>
        )}
      </View>
      <TextInput
        style={[
          styles.fieldInput,
          !editable && styles.fieldInputDisabled,
          confidence < 0.6 && styles.fieldInputWarning,
        ]}
        value={value || ''}
        onChangeText={onChange}
        editable={editable}
        placeholder={`No ${label.toLowerCase()} detected`}
        placeholderTextColor="#999"
      />
    </View>
  );
};

export default function OCRResultsModal({
  visible,
  ocrData,
  onConfirm,
  onRescan,
  onClose,
  loading = false,
}) {
  const [editedData, setEditedData] = useState({
    fullName: '',
    idNumber: '',
    birthdate: '',
    address: '',
  });

  useEffect(() => {
    if (ocrData) {
      setEditedData({
        fullName: ocrData.fullName || ocrData.extracted_data?.full_name || '',
        idNumber: ocrData.idNumber || ocrData.extracted_data?.id_number || '',
        birthdate: ocrData.birthdate || ocrData.extracted_data?.birthdate || '',
        address: ocrData.address || ocrData.extracted_data?.address || '',
      });
    }
  }, [ocrData]);

  const idType = ocrData?.idType || ocrData?.id_type || 'unknown';
  const idTypeLabel = ID_TYPE_LABELS[idType] || 'Unknown ID';
  const idTypeColor = ID_TYPE_COLORS[idType] || '#757575';

  const confidenceScores = ocrData?.confidenceScores || ocrData?.confidence_scores || {};
  const overallConfidence = ocrData?.overallConfidence || ocrData?.overall_confidence || 0;

  const handleConfirm = () => {
    onConfirm(editedData);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>ID Scan Results</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>X</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1976D2" />
              <Text style={styles.loadingText}>Processing ID...</Text>
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* ID Type Badge */}
              <View style={styles.idTypeBadgeContainer}>
                <View style={[styles.idTypeBadge, { backgroundColor: idTypeColor }]}>
                  <Text style={styles.idTypeBadgeText}>{idTypeLabel}</Text>
                </View>
              </View>

              {/* Overall Confidence */}
              <View style={styles.overallConfidenceContainer}>
                <Text style={styles.overallConfidenceLabel}>Overall Confidence</Text>
                <View style={styles.overallConfidenceCircle}>
                  <Text
                    style={[
                      styles.overallConfidenceValue,
                      { color: getConfidenceColor(overallConfidence) },
                    ]}
                  >
                    {Math.round(overallConfidence * 100)}%
                  </Text>
                  <Text style={styles.overallConfidenceStatus}>
                    {getConfidenceLabel(overallConfidence)}
                  </Text>
                </View>
              </View>

              {/* Extracted Fields */}
              <Text style={styles.sectionTitle}>Extracted Information</Text>
              <Text style={styles.sectionSubtitle}>
                Review and edit if needed
              </Text>

              <FieldInput
                label="Full Name"
                value={editedData.fullName}
                confidence={confidenceScores.full_name || confidenceScores.fullName || 0}
                onChange={(text) => setEditedData({ ...editedData, fullName: text })}
              />

              <FieldInput
                label="ID Number"
                value={editedData.idNumber}
                confidence={confidenceScores.id_number || confidenceScores.idNumber || 0}
                onChange={(text) => setEditedData({ ...editedData, idNumber: text })}
              />

              <FieldInput
                label="Birthdate"
                value={editedData.birthdate}
                confidence={confidenceScores.birthdate || 0}
                onChange={(text) => setEditedData({ ...editedData, birthdate: text })}
              />

              <FieldInput
                label="Address"
                value={editedData.address}
                confidence={confidenceScores.address || 0}
                onChange={(text) => setEditedData({ ...editedData, address: text })}
              />

              {/* Confidence Summary */}
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                Confidence Breakdown
              </Text>
              <ConfidenceBar
                score={confidenceScores.full_name || confidenceScores.fullName || 0}
                label="Name"
              />
              <ConfidenceBar
                score={confidenceScores.id_number || confidenceScores.idNumber || 0}
                label="ID Number"
              />
              <ConfidenceBar
                score={confidenceScores.birthdate || 0}
                label="Birthdate"
              />
              <ConfidenceBar
                score={confidenceScores.address || 0}
                label="Address"
              />

              {/* Low Confidence Warning */}
              {overallConfidence < 0.6 && (
                <View style={styles.warningContainer}>
                  <Text style={styles.warningText}>
                    Low confidence detected. Please verify the extracted information
                    carefully or try rescanning with better lighting.
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* Actions */}
          {!loading && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.rescanButton]}
                onPress={onRescan}
              >
                <Text style={styles.rescanButtonText}>Rescan</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleConfirm}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    padding: 20,
  },
  idTypeBadgeContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  idTypeBadge: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  idTypeBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  overallConfidenceContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  overallConfidenceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  overallConfidenceCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overallConfidenceValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  overallConfidenceStatus: {
    fontSize: 12,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  confidenceBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#FAFAFA',
    color: '#333',
  },
  fieldInputDisabled: {
    backgroundColor: '#F0F0F0',
    color: '#999',
  },
  fieldInputWarning: {
    borderColor: '#FF9800',
    backgroundColor: '#FFF8E1',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  confidenceLabel: {
    width: 70,
    fontSize: 13,
    color: '#666',
  },
  confidenceBarOuter: {
    flex: 1,
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginHorizontal: 10,
  },
  confidenceBarInner: {
    height: 8,
    borderRadius: 4,
  },
  confidenceText: {
    width: 40,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  warningContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    color: '#E65100',
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescanButton: {
    backgroundColor: '#F5F5F5',
    marginRight: 10,
  },
  rescanButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  confirmButton: {
    backgroundColor: '#1976D2',
    marginLeft: 10,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
