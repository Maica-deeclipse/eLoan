/**
 * IDScannerModal
 * Camera modal with an ID-card sized rectangular guide frame.
 * Shows real-time preview, alignment instructions, and a countdown auto-capture.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ID card aspect ratio (standard CR80 card: 85.6mm × 53.98mm ≈ 1.586)
const ID_FRAME_WIDTH = SCREEN_WIDTH * 0.82;
const ID_FRAME_HEIGHT = ID_FRAME_WIDTH / 1.586;
const CORNER_SIZE = 22;
const CORNER_THICKNESS = 4;

export default function IDScannerModal({ visible, onCapture, onClose }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState('back');
  const [countdown, setCountdown] = useState(null); // null = idle, 3/2/1 = counting
  const [capturing, setCapturing] = useState(false);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      // Reset state when modal closes
      clearInterval(countdownRef.current);
      setCountdown(null);
      setCapturing(false);
    }
  }, [visible]);

  useEffect(() => {
    if (countdown === 0) {
      clearInterval(countdownRef.current);
      handleTakePhoto();
    }
  }, [countdown]);

  const startCountdown = () => {
    if (capturing || countdown !== null) return;
    setCountdown(3);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
  };

  const cancelCountdown = () => {
    clearInterval(countdownRef.current);
    setCountdown(null);
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    setCountdown(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,
        skipProcessing: false,
      });
      onCapture(photo);
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  };

  const toggleFacing = () => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#6b7280" />
          <Text style={styles.permissionTitle}>Camera Access Needed</Text>
          <Text style={styles.permissionText}>
            Camera access is required to scan your ID.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeTextButton} onPress={onClose}>
            <Text style={styles.closeTextButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
        {/* Camera */}
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
        />

        {/* Dark overlay with transparent ID cutout */}
        <View style={styles.overlay} pointerEvents="none">
          {/* Top dark bar */}
          <View style={[styles.overlaySection, { flex: 1 }]} />

          {/* Middle row: dark | transparent frame | dark */}
          <View style={styles.overlayMiddleRow}>
            <View style={[styles.overlaySection, { width: (SCREEN_WIDTH - ID_FRAME_WIDTH) / 2 }]} />
            <View style={[styles.frameWindow, { width: ID_FRAME_WIDTH, height: ID_FRAME_HEIGHT }]}>
              {/* Corner brackets */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <View style={[styles.overlaySection, { width: (SCREEN_WIDTH - ID_FRAME_WIDTH) / 2 }]} />
          </View>

          {/* Bottom dark bar */}
          <View style={[styles.overlaySection, { flex: 1 }]} />
        </View>

        {/* Top bar: close + flip */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={onClose}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Scan ID</Text>
          <TouchableOpacity style={styles.iconButton} onPress={toggleFacing}>
            <Ionicons name="camera-reverse-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Instruction text above frame */}
        <View style={styles.instructionContainer}>
          <Text style={styles.instructionText}>Align your ID within the frame</Text>
          <Text style={styles.instructionSub}>Hold steady — front side facing the camera</Text>
        </View>

        {/* Countdown overlay */}
        {countdown !== null && countdown > 0 && (
          <View style={styles.countdownOverlay} pointerEvents="none">
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        )}

        {/* Bottom controls */}
        <View style={styles.bottomControls}>
          {countdown !== null ? (
            <TouchableOpacity style={styles.cancelButton} onPress={cancelCountdown}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.captureHint}>
                Tap to capture when aligned
              </Text>
              <TouchableOpacity
                style={[styles.captureButton, capturing && styles.captureButtonDisabled]}
                onPress={startCountdown}
                disabled={capturing}
                activeOpacity={0.8}
              >
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
              <Text style={styles.captureHint}>Auto-captures in 3s</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'column',
  },
  overlaySection: {
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  overlayMiddleRow: {
    flexDirection: 'row',
    height: ID_FRAME_HEIGHT,
  },
  frameWindow: {
    // Transparent — shows camera feed
    position: 'relative',
  },
  // Corner bracket styling
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: '#fff',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 4,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 48,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBarTitle: {
    color: '#fff',
    fontSize: 17,
    fontFamily: 'Poppins_600SemiBold',
  },
  iconButton: {
    padding: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  instructionContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.13 + ID_FRAME_HEIGHT * 0.02,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  instructionSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    fontSize: 96,
    fontFamily: 'Poppins_800ExtraBold',
    color: 'rgba(255,255,255,0.9)',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  captureHint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  captureButtonDisabled: {
    opacity: 0.4,
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  cancelButton: {
    paddingVertical: 14,
    paddingHorizontal: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  // Permission screen
  permissionContainer: {
    flex: 1,
    backgroundColor: '#1f2937',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionText: {
    color: '#9ca3af',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionButton: {
    backgroundColor: '#0d6efd',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
  },
  closeTextButton: {
    paddingVertical: 10,
  },
  closeTextButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
