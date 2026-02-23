import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useApplication } from '../../context/ApplicationContext';
import applicationService from '../../services/applicationService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAMERA_SIZE = SCREEN_WIDTH - 80;

const LIVENESS_CHALLENGES = [
  { action: 'blink', instruction: 'Blink your eyes', icon: 'eye-outline' },
  { action: 'smile', instruction: 'Smile naturally', icon: 'happy-outline' },
  { action: 'turn_left', instruction: 'Turn your head slightly left', icon: 'arrow-back' },
  { action: 'turn_right', instruction: 'Turn your head slightly right', icon: 'arrow-forward' },
];

const FaceVerificationScreen = ({ navigation }) => {
  const { state, dispatch } = useApplication();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState('intro'); // intro, face_capture, liveness, complete
  const [capturedImage, setCapturedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [livenessIndex, setLivenessIndex] = useState(0);
  const [livenessImages, setLivenessImages] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    // Check if face verification is already done
    if (state.faceVerification?.completed) {
      setCapturedImage(state.faceVerification.imageUri);
      setStep('complete');
    }
  }, []);

  useEffect(() => {
    if (step === 'face_capture' || step === 'liveness') {
      setCameraReady(false);
    }
  }, [step]);

  const handleCameraReady = () => {
    setCameraReady(true);
  };

  const requestCameraPermission = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      return result.granted;
    }
    return true;
  };

  const startFaceCapture = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert(
        'Camera Permission Required',
        'Please grant camera access to complete face verification.'
      );
      return;
    }
    setStep('face_capture');
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;
    if (!cameraReady || typeof cameraRef.current.takePictureAsync !== 'function') {
      Alert.alert('Camera', 'Camera is still initializing. Please try again.');
      return;
    }

    setIsCapturing(true);
    setCountdown(3);
    const activeStep = step;

    // Countdown before capture
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setCountdown(null);

    try {
      if (!cameraRef.current || typeof cameraRef.current.takePictureAsync !== 'function') {
        throw new Error('Camera not ready');
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: true,
      });

      if (activeStep === 'face_capture') {
        setCapturedImage(photo.uri);
        setStep('liveness');
        setLivenessIndex(0);
      } else if (activeStep === 'liveness') {
        const currentChallenge = LIVENESS_CHALLENGES[livenessIndex];
        const newLivenessImages = [
          ...livenessImages,
          { uri: photo.uri, action: currentChallenge.action },
        ];
        setLivenessImages(newLivenessImages);

        if (livenessIndex < LIVENESS_CHALLENGES.length - 1) {
          setLivenessIndex(livenessIndex + 1);
        } else {
          // All liveness checks complete, submit
          await submitVerification(capturedImage, newLivenessImages);
        }
      }
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const submitVerification = async (faceImage, livenessImgs) => {
    setLoading(true);
    try {
      if (!faceImage) {
        throw new Error('Missing face image');
      }
      await applicationService.uploadFaceCapture(state.applicationId, faceImage);
      for (const entry of livenessImgs) {
        await applicationService.performLivenessCheck(
          state.applicationId,
          entry.uri,
          entry.action
        );
      }

      dispatch({
        type: 'SET_FACE_VERIFICATION',
        payload: { completed: true, imageUri: faceImage, verified: true },
      });
      dispatch({
        type: 'SET_LIVENESS_CHECK',
        payload: { completed: true, verified: true },
      });

      setStep('complete');
      Alert.alert('Success', 'Face verification completed successfully!');
    } catch (error) {
      console.error('Verification error:', error);
      Alert.alert(
        'Verification Failed',
        error.response?.data?.error || 'Please try again with better lighting.'
      );
      // Reset to try again
      setStep('intro');
      setCapturedImage(null);
      setLivenessImages([]);
      setLivenessIndex(0);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (step !== 'complete') {
      Alert.alert('Verification Required', 'Please complete face verification to continue.');
      return;
    }

    dispatch({ type: 'SET_STEP', payload: 7 });
    navigation.navigate('ESignature');
  };

  const retakeVerification = () => {
    setCapturedImage(null);
    setLivenessImages([]);
    setLivenessIndex(0);
    setStep('face_capture');
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0d6efd" />
      </View>
    );
  }

  const renderIntro = () => (
    <View style={styles.introContainer}>
      <View style={styles.illustrationContainer}>
        <View style={styles.faceIllustration}>
          <Ionicons name="person-circle" size={120} color="#0d6efd" />
        </View>
      </View>

      <Text style={styles.introTitle}>Face Verification</Text>
      <Text style={styles.introSubtitle}>
        We need to verify your identity. Please ensure you're in a well-lit area and position your
        face within the frame.
      </Text>

      <View style={styles.requirementsList}>
        <View style={styles.requirementItem}>
          <Ionicons name="checkmark-circle" size={24} color="#28a745" />
          <Text style={styles.requirementText}>Good lighting</Text>
        </View>
        <View style={styles.requirementItem}>
          <Ionicons name="checkmark-circle" size={24} color="#28a745" />
          <Text style={styles.requirementText}>Face clearly visible</Text>
        </View>
        <View style={styles.requirementItem}>
          <Ionicons name="checkmark-circle" size={24} color="#28a745" />
          <Text style={styles.requirementText}>No sunglasses or face coverings</Text>
        </View>
        <View style={styles.requirementItem}>
          <Ionicons name="checkmark-circle" size={24} color="#28a745" />
          <Text style={styles.requirementText}>Neutral background</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={startFaceCapture}>
        <Ionicons name="camera" size={24} color="#fff" />
        <Text style={styles.startButtonText}>Start Verification</Text>
      </TouchableOpacity>
    </View>
  );

  const renderFaceCapture = () => (
    <View style={styles.cameraContainer}>
      <Text style={styles.cameraTitle}>Position Your Face</Text>
      <Text style={styles.cameraSubtitle}>
        Align your face within the oval frame and keep steady
      </Text>

      <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={handleCameraReady}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.faceFrame} />
          </View>
          {countdown !== null && (
            <View style={styles.countdownContainer}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}
        </CameraView>
      </View>

      <TouchableOpacity
        style={styles.captureButton}
        onPress={capturePhoto}
        disabled={countdown !== null}
      >
        <View style={styles.captureButtonInner}>
          <Ionicons name="camera" size={32} color="#fff" />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => setStep('intro')}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );

  const renderLiveness = () => {
    const currentChallenge = LIVENESS_CHALLENGES[livenessIndex];

    return (
      <View style={styles.cameraContainer}>
        <View style={styles.livenessHeader}>
          <Text style={styles.livenessTitle}>Liveness Check</Text>
          <Text style={styles.livenessProgress}>
            {livenessIndex + 1} of {LIVENESS_CHALLENGES.length}
          </Text>
        </View>

        <View style={styles.challengeContainer}>
          <View style={styles.challengeIcon}>
            <Ionicons name={currentChallenge.icon} size={40} color="#0d6efd" />
          </View>
          <Text style={styles.challengeInstruction}>{currentChallenge.instruction}</Text>
        </View>

        <View style={styles.cameraWrapper}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          onCameraReady={handleCameraReady}
        >
            <View style={styles.cameraOverlay}>
              <View style={styles.faceFrame} />
            </View>
            {countdown !== null && (
              <View style={styles.countdownContainer}>
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            )}
          </CameraView>
        </View>

        <TouchableOpacity
          style={styles.captureButton}
          onPress={capturePhoto}
          disabled={countdown !== null || loading}
        >
          {loading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <View style={styles.captureButtonInner}>
              <Ionicons name="camera" size={32} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.livenessIndicators}>
          {LIVENESS_CHALLENGES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.livenessIndicator,
                index < livenessIndex && styles.livenessIndicatorComplete,
                index === livenessIndex && styles.livenessIndicatorCurrent,
              ]}
            />
          ))}
        </View>
      </View>
    );
  };

  const renderComplete = () => (
    <View style={styles.completeContainer}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark-circle" size={80} color="#28a745" />
      </View>

      <Text style={styles.completeTitle}>Verification Complete!</Text>
      <Text style={styles.completeSubtitle}>
        Your face has been successfully verified
      </Text>

      {capturedImage && (
        <View style={styles.capturedImageContainer}>
          <Image source={{ uri: capturedImage }} style={styles.capturedImage} />
        </View>
      )}

      <TouchableOpacity style={styles.retakeButton} onPress={retakeVerification}>
        <Ionicons name="refresh" size={20} color="#0d6efd" />
        <Text style={styles.retakeButtonText}>Retake Verification</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '75%' }]} />
        </View>
        <Text style={styles.progressText}>Step 6 of 8</Text>
      </View>

      {step === 'intro' && renderIntro()}
      {step === 'face_capture' && renderFaceCapture()}
      {step === 'liveness' && renderLiveness()}
      {step === 'complete' && renderComplete()}

      {/* Navigation Buttons (only show on intro and complete) */}
      {(step === 'intro' || step === 'complete') && (
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
              step !== 'complete' && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={step !== 'complete'}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
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
  // Intro styles
  introContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  faceIllustration: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#e7f1ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  introTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    textAlign: 'center',
    marginBottom: 12,
  },
  introSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  requirementsList: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  requirementText: {
    fontSize: 15,
    color: '#495057',
    marginLeft: 12,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d6efd',
    paddingVertical: 16,
    borderRadius: 12,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 10,
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cameraTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 8,
  },
  cameraSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  cameraWrapper: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: CAMERA_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceFrame: {
    width: CAMERA_SIZE - 60,
    height: CAMERA_SIZE - 40,
    borderRadius: (CAMERA_SIZE - 60) / 2,
    borderWidth: 3,
    borderColor: '#0d6efd',
    borderStyle: 'dashed',
  },
  countdownContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  countdownText: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fff',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0d6efd',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    shadowColor: '#0d6efd',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#0d6efd',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cancelButtonText: {
    color: '#6c757d',
    fontSize: 16,
  },
  // Liveness styles
  livenessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  livenessTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212529',
  },
  livenessProgress: {
    fontSize: 14,
    color: '#6c757d',
    backgroundColor: '#e9ecef',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  challengeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e7f1ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  challengeIcon: {
    marginRight: 12,
  },
  challengeInstruction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0d6efd',
  },
  livenessIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  livenessIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#dee2e6',
    marginHorizontal: 4,
  },
  livenessIndicatorComplete: {
    backgroundColor: '#28a745',
  },
  livenessIndicatorCurrent: {
    backgroundColor: '#0d6efd',
    width: 24,
  },
  // Complete styles
  completeContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  successIcon: {
    marginBottom: 24,
  },
  completeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#28a745',
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 24,
  },
  capturedImageContainer: {
    marginBottom: 24,
  },
  capturedImage: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 4,
    borderColor: '#28a745',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#0d6efd',
    borderRadius: 12,
  },
  retakeButtonText: {
    color: '#0d6efd',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Navigation buttons
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

export default FaceVerificationScreen;
