/**
 * Name Mismatch Modal Component
 *
 * Displays when OCR extracted name doesn't match profile name.
 * Shows both names side-by-side and requires user to resolve the mismatch.
 *
 * Options:
 * - Use OCR Name (update profile)
 * - Use Profile Name (keep existing)
 * - Edit Manually (custom input)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';

export default function NameMismatchModal({
  visible,
  ocrName,
  profileName,
  similarity,
  onUseOcrName,
  onUseProfileName,
  onUseCustomName,
  onCancel,
}) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customName, setCustomName] = useState('');

  const handleUseCustomName = () => {
    if (customName.trim()) {
      onUseCustomName(customName.trim());
      setShowCustomInput(false);
      setCustomName('');
    }
  };

  const handleCancel = () => {
    setShowCustomInput(false);
    setCustomName('');
    onCancel();
  };

  const similarityPercentage = Math.round((similarity || 0) * 100);

  // Find differences between names for highlighting
  const highlightDifferences = (name1, name2) => {
    if (!name1) return [{ word: 'Unknown', isDifferent: true }];
    if (!name2) return name1.split(' ').map(word => ({ word, isDifferent: false }));

    const words1 = name1.toUpperCase().split(' ').filter(w => w.trim());
    const words2 = name2.toUpperCase().split(' ').filter(w => w.trim());

    return words1.map((word) => {
      const isDifferent = !words2.includes(word);
      return { word, isDifferent };
    });
  };

  const ocrNameParts = highlightDifferences(ocrName, profileName) || [];
  const profileNameParts = highlightDifferences(profileName, ocrName) || [];

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Warning Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.warningIcon}>
              <Text style={styles.warningIconText}>!</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>Name Mismatch Detected</Text>
          <Text style={styles.subtitle}>
            The name on your ID doesn't match your profile name.
            Please select the correct name to proceed.
          </Text>

          {/* Similarity Score */}
          <View style={styles.similarityContainer}>
            <Text style={styles.similarityLabel}>Similarity Score:</Text>
            <Text
              style={[
                styles.similarityValue,
                { color: similarity >= 0.7 ? '#FF9800' : '#F44336' },
              ]}
            >
              {similarityPercentage}%
            </Text>
          </View>

          {/* Name Comparison */}
          <View style={styles.comparisonContainer}>
            {/* OCR Name */}
            <View style={styles.nameCard}>
              <Text style={styles.nameCardLabel}>From ID (OCR)</Text>
              <View style={styles.nameTextContainer}>
                {ocrNameParts.map((part, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.nameText,
                      part.isDifferent && styles.nameDifferent,
                    ]}
                  >
                    {part.word}{' '}
                  </Text>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.useButton, styles.useOcrButton]}
                onPress={onUseOcrName}
              >
                <Text style={styles.useButtonText}>Use This Name</Text>
              </TouchableOpacity>
            </View>

            {/* VS Divider */}
            <View style={styles.vsDivider}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            {/* Profile Name */}
            <View style={styles.nameCard}>
              <Text style={styles.nameCardLabel}>From Profile</Text>
              <View style={styles.nameTextContainer}>
                {profileNameParts.map((part, index) => (
                  <Text
                    key={index}
                    style={[
                      styles.nameText,
                      part.isDifferent && styles.nameDifferent,
                    ]}
                  >
                    {part.word}{' '}
                  </Text>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.useButton, styles.useProfileButton]}
                onPress={onUseProfileName}
              >
                <Text style={styles.useButtonText}>Use This Name</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Custom Input */}
          {showCustomInput ? (
            <View style={styles.customInputContainer}>
              <Text style={styles.customInputLabel}>Enter correct name:</Text>
              <TextInput
                style={styles.customInput}
                value={customName}
                onChangeText={setCustomName}
                placeholder="Enter your full legal name"
                placeholderTextColor="#999"
                autoCapitalize="words"
                autoFocus
              />
              <View style={styles.customInputActions}>
                <TouchableOpacity
                  style={styles.customCancelButton}
                  onPress={() => {
                    setShowCustomInput(false);
                    setCustomName('');
                  }}
                >
                  <Text style={styles.customCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.customConfirmButton,
                    !customName.trim() && styles.customConfirmButtonDisabled,
                  ]}
                  onPress={handleUseCustomName}
                  disabled={!customName.trim()}
                >
                  <Text style={styles.customConfirmText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.editManuallyButton}
              onPress={() => setShowCustomInput(true)}
            >
              <Text style={styles.editManuallyText}>Edit Manually</Text>
            </TouchableOpacity>
          )}

          {/* Cancel Link */}
          <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
            <Text style={styles.cancelLinkText}>Cancel and Rescan</Text>
          </TouchableOpacity>

          {/* Notice */}
          <View style={styles.noticeContainer}>
            <Text style={styles.noticeText}>
              Your name must match your government-issued ID for loan processing.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  warningIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FF9800',
  },
  warningIconText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF9800',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  similarityContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  similarityLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  similarityValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  comparisonContainer: {
    marginBottom: 20,
  },
  nameCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  nameCardLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  nameText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  nameDifferent: {
    color: '#F44336',
    backgroundColor: '#FFEBEE',
    borderRadius: 4,
    overflow: 'hidden',
  },
  useButton: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  useOcrButton: {
    backgroundColor: '#1976D2',
  },
  useProfileButton: {
    backgroundColor: '#4CAF50',
  },
  useButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  vsDivider: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  vsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
  },
  editManuallyButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  editManuallyText: {
    color: '#1976D2',
    fontWeight: '600',
    fontSize: 15,
  },
  customInputContainer: {
    marginBottom: 16,
  },
  customInputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
    marginBottom: 12,
  },
  customInputActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  customCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  customCancelText: {
    color: '#666',
    fontSize: 14,
  },
  customConfirmButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  customConfirmButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  customConfirmText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  cancelLink: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelLinkText: {
    color: '#999',
    fontSize: 14,
  },
  noticeContainer: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  noticeText: {
    color: '#1565C0',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
