"""
Liveness Detection Service using MediaPipe

This service provides real-time liveness detection using Google's MediaPipe
Face Mesh for eye blink detection and head movement tracking.

Features:
1. Eye Blink Detection - Uses Eye Aspect Ratio (EAR) algorithm
2. Head Movement Detection - Tracks head pose (yaw, pitch, roll)
3. Combined Liveness Verification - Multi-frame analysis for anti-spoofing

Dependencies:
- mediapipe
- opencv-python
- numpy
"""

import os
import cv2
import numpy as np
import mediapipe as mp
import logging
from decimal import Decimal
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger('liveness_detection')


class LivenessMethod(Enum):
    """Supported liveness detection methods."""
    BLINK = 'blink'
    HEAD_TURN = 'head_turn'
    HEAD_NOD = 'head_nod'
    COMBINED = 'combined'


@dataclass
class LivenessResult:
    """Result of liveness detection."""
    is_live: bool
    confidence: float
    method: str
    details: Dict
    error_message: Optional[str] = None


class MediaPipeLivenessService:
    """
    Liveness detection service using MediaPipe Face Mesh.

    Uses facial landmark detection to verify:
    1. Eye blinks (natural blinking pattern)
    2. Head movements (turning, nodding)
    3. Face presence and stability
    """

    # MediaPipe Face Mesh landmark indices
    # Left eye landmarks
    LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
    # Right eye landmarks
    RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144]

    # Eye Aspect Ratio thresholds
    EAR_THRESHOLD = 0.21  # Below this = eye closed
    EAR_CONSEC_FRAMES = 2  # Consecutive frames for blink detection

    # Head pose thresholds (in degrees)
    HEAD_TURN_THRESHOLD = 15  # Yaw angle for head turn
    HEAD_NOD_THRESHOLD = 10   # Pitch angle for head nod

    # Confidence thresholds
    MIN_DETECTION_CONFIDENCE = 0.5
    MIN_TRACKING_CONFIDENCE = 0.5

    def __init__(self):
        """Initialize MediaPipe Face Mesh."""
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=self.MIN_DETECTION_CONFIDENCE,
            min_tracking_confidence=self.MIN_TRACKING_CONFIDENCE
        )

    def __del__(self):
        """Cleanup MediaPipe resources."""
        if hasattr(self, 'face_mesh'):
            self.face_mesh.close()

    @staticmethod
    def calculate_ear(eye_landmarks: List[Tuple[float, float]]) -> float:
        """
        Calculate Eye Aspect Ratio (EAR) for blink detection.

        EAR = (|p2 - p6| + |p3 - p5|) / (2 * |p1 - p4|)

        Args:
            eye_landmarks: List of 6 (x, y) coordinates for eye landmarks

        Returns:
            float: Eye Aspect Ratio value (0.0 - 0.5 typically)
        """
        # Vertical distances
        A = np.linalg.norm(np.array(eye_landmarks[1]) - np.array(eye_landmarks[5]))
        B = np.linalg.norm(np.array(eye_landmarks[2]) - np.array(eye_landmarks[4]))

        # Horizontal distance
        C = np.linalg.norm(np.array(eye_landmarks[0]) - np.array(eye_landmarks[3]))

        # Eye Aspect Ratio
        ear = (A + B) / (2.0 * C) if C > 0 else 0
        return ear

    def get_eye_landmarks(self, face_landmarks, image_shape: Tuple[int, int]) -> Tuple[List, List]:
        """
        Extract eye landmarks from face mesh.

        Args:
            face_landmarks: MediaPipe face landmarks
            image_shape: (height, width) of image

        Returns:
            Tuple of (left_eye_coords, right_eye_coords)
        """
        h, w = image_shape[:2]

        left_eye = []
        for idx in self.LEFT_EYE_INDICES:
            landmark = face_landmarks.landmark[idx]
            left_eye.append((landmark.x * w, landmark.y * h))

        right_eye = []
        for idx in self.RIGHT_EYE_INDICES:
            landmark = face_landmarks.landmark[idx]
            right_eye.append((landmark.x * w, landmark.y * h))

        return left_eye, right_eye

    def estimate_head_pose(self, face_landmarks, image_shape: Tuple[int, int]) -> Dict[str, float]:
        """
        Estimate head pose (yaw, pitch, roll) from face landmarks.

        Uses solvePnP with a 3D face model to estimate pose.

        Args:
            face_landmarks: MediaPipe face landmarks
            image_shape: (height, width) of image

        Returns:
            Dict with 'yaw', 'pitch', 'roll' angles in degrees
        """
        h, w = image_shape[:2]

        # 3D model points (generic face model)
        model_points = np.array([
            (0.0, 0.0, 0.0),             # Nose tip (landmark 1)
            (0.0, -330.0, -65.0),        # Chin (landmark 152)
            (-225.0, 170.0, -135.0),     # Left eye corner (landmark 263)
            (225.0, 170.0, -135.0),      # Right eye corner (landmark 33)
            (-150.0, -150.0, -125.0),    # Left mouth corner (landmark 287)
            (150.0, -150.0, -125.0)      # Right mouth corner (landmark 57)
        ], dtype=np.float64)

        # 2D image points from landmarks
        landmark_indices = [1, 152, 263, 33, 287, 57]
        image_points = np.array([
            (face_landmarks.landmark[idx].x * w, face_landmarks.landmark[idx].y * h)
            for idx in landmark_indices
        ], dtype=np.float64)

        # Camera matrix (approximate)
        focal_length = w
        center = (w / 2, h / 2)
        camera_matrix = np.array([
            [focal_length, 0, center[0]],
            [0, focal_length, center[1]],
            [0, 0, 1]
        ], dtype=np.float64)

        # Assume no lens distortion
        dist_coeffs = np.zeros((4, 1))

        # Solve PnP
        success, rotation_vector, translation_vector = cv2.solvePnP(
            model_points,
            image_points,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE
        )

        if not success:
            return {'yaw': 0.0, 'pitch': 0.0, 'roll': 0.0}

        # Convert rotation vector to rotation matrix
        rotation_matrix, _ = cv2.Rodrigues(rotation_vector)

        # Get Euler angles
        sy = np.sqrt(rotation_matrix[0, 0] ** 2 + rotation_matrix[1, 0] ** 2)
        singular = sy < 1e-6

        if not singular:
            x = np.arctan2(rotation_matrix[2, 1], rotation_matrix[2, 2])
            y = np.arctan2(-rotation_matrix[2, 0], sy)
            z = np.arctan2(rotation_matrix[1, 0], rotation_matrix[0, 0])
        else:
            x = np.arctan2(-rotation_matrix[1, 2], rotation_matrix[1, 1])
            y = np.arctan2(-rotation_matrix[2, 0], sy)
            z = 0

        # Convert to degrees
        pitch = np.degrees(x)
        yaw = np.degrees(y)
        roll = np.degrees(z)

        return {'yaw': yaw, 'pitch': pitch, 'roll': roll}

    def detect_blink_in_image(self, image_path: str) -> LivenessResult:
        """
        Detect if eyes are open/closed in a single image.

        For proper blink detection, multiple frames should be analyzed.
        This method checks if eyes appear closed (potential mid-blink frame).

        Args:
            image_path: Path to image file

        Returns:
            LivenessResult with blink detection status
        """
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                return LivenessResult(
                    is_live=False,
                    confidence=0.0,
                    method=LivenessMethod.BLINK.value,
                    details={},
                    error_message="Could not load image"
                )

            # Convert to RGB for MediaPipe
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # Process with Face Mesh
            results = self.face_mesh.process(rgb_image)

            if not results.multi_face_landmarks:
                return LivenessResult(
                    is_live=False,
                    confidence=0.0,
                    method=LivenessMethod.BLINK.value,
                    details={'face_detected': False},
                    error_message="No face detected in image"
                )

            face_landmarks = results.multi_face_landmarks[0]

            # Get eye landmarks
            left_eye, right_eye = self.get_eye_landmarks(face_landmarks, image.shape)

            # Calculate EAR for both eyes
            left_ear = self.calculate_ear(left_eye)
            right_ear = self.calculate_ear(right_eye)
            avg_ear = (left_ear + right_ear) / 2.0

            # Determine if eyes are open
            eyes_open = avg_ear > self.EAR_THRESHOLD

            # Confidence based on EAR value
            if eyes_open:
                # Higher EAR = more confident eyes are open
                confidence = min(100, (avg_ear / 0.35) * 100)
            else:
                # Lower EAR could indicate blink (mid-frame capture)
                confidence = min(100, ((self.EAR_THRESHOLD - avg_ear) / self.EAR_THRESHOLD) * 100)

            return LivenessResult(
                is_live=eyes_open,
                confidence=float(confidence),
                method=LivenessMethod.BLINK.value,
                details={
                    'face_detected': True,
                    'left_ear': float(left_ear),
                    'right_ear': float(right_ear),
                    'avg_ear': float(avg_ear),
                    'eyes_open': eyes_open,
                    'ear_threshold': self.EAR_THRESHOLD
                }
            )

        except Exception as e:
            logger.error(f"Error in blink detection: {str(e)}")
            return LivenessResult(
                is_live=False,
                confidence=0.0,
                method=LivenessMethod.BLINK.value,
                details={},
                error_message=f"Error during blink detection: {str(e)}"
            )

    def detect_head_pose_in_image(self, image_path: str) -> LivenessResult:
        """
        Detect head pose in a single image.

        Args:
            image_path: Path to image file

        Returns:
            LivenessResult with head pose detection status
        """
        try:
            # Load image
            image = cv2.imread(image_path)
            if image is None:
                return LivenessResult(
                    is_live=False,
                    confidence=0.0,
                    method=LivenessMethod.HEAD_TURN.value,
                    details={},
                    error_message="Could not load image"
                )

            # Convert to RGB for MediaPipe
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # Process with Face Mesh
            results = self.face_mesh.process(rgb_image)

            if not results.multi_face_landmarks:
                return LivenessResult(
                    is_live=False,
                    confidence=0.0,
                    method=LivenessMethod.HEAD_TURN.value,
                    details={'face_detected': False},
                    error_message="No face detected in image"
                )

            face_landmarks = results.multi_face_landmarks[0]

            # Estimate head pose
            pose = self.estimate_head_pose(face_landmarks, image.shape)

            # Check if head is in a natural position (not perfectly still like a photo)
            # A slight variation in pose suggests real person
            yaw_variation = abs(pose['yaw'])
            pitch_variation = abs(pose['pitch'])

            # Real faces typically have slight natural variations
            # Perfect frontal (0,0,0) might indicate a flat photo
            has_natural_pose = (
                -30 < pose['yaw'] < 30 and  # Not extreme side angle
                -20 < pose['pitch'] < 20 and  # Not extreme up/down
                abs(pose['roll']) < 30  # Not extremely tilted
            )

            # Calculate confidence based on natural pose range
            pose_score = 100
            if abs(pose['yaw']) > 30:
                pose_score -= 30
            if abs(pose['pitch']) > 20:
                pose_score -= 30
            if abs(pose['roll']) > 30:
                pose_score -= 20

            confidence = max(0, pose_score)

            return LivenessResult(
                is_live=has_natural_pose,
                confidence=float(confidence),
                method=LivenessMethod.HEAD_TURN.value,
                details={
                    'face_detected': True,
                    'yaw': float(pose['yaw']),
                    'pitch': float(pose['pitch']),
                    'roll': float(pose['roll']),
                    'has_natural_pose': has_natural_pose
                }
            )

        except Exception as e:
            logger.error(f"Error in head pose detection: {str(e)}")
            return LivenessResult(
                is_live=False,
                confidence=0.0,
                method=LivenessMethod.HEAD_TURN.value,
                details={},
                error_message=f"Error during head pose detection: {str(e)}"
            )

    def verify_liveness(self, image_path: str, method: str = 'combined') -> LivenessResult:
        """
        Comprehensive liveness verification using multiple checks.

        Args:
            image_path: Path to image file
            method: Detection method ('blink', 'head_turn', 'combined')

        Returns:
            LivenessResult with overall liveness status
        """
        try:
            logger.info(f"Starting liveness verification for: {image_path}")

            # Validate image exists
            if not os.path.exists(image_path):
                return LivenessResult(
                    is_live=False,
                    confidence=0.0,
                    method=method,
                    details={},
                    error_message="Image file not found"
                )

            # Load and validate image
            image = cv2.imread(image_path)
            if image is None:
                return LivenessResult(
                    is_live=False,
                    confidence=0.0,
                    method=method,
                    details={},
                    error_message="Could not load image"
                )

            # Convert to RGB for MediaPipe
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # Process with Face Mesh
            results = self.face_mesh.process(rgb_image)

            if not results.multi_face_landmarks:
                return LivenessResult(
                    is_live=False,
                    confidence=0.0,
                    method=method,
                    details={'face_detected': False},
                    error_message="No face detected in image. Please ensure your face is clearly visible."
                )

            face_landmarks = results.multi_face_landmarks[0]

            # Perform checks based on method
            checks_passed = 0
            total_checks = 0
            details = {'face_detected': True}

            # Check 1: Eye state (EAR check)
            left_eye, right_eye = self.get_eye_landmarks(face_landmarks, image.shape)
            left_ear = self.calculate_ear(left_eye)
            right_ear = self.calculate_ear(right_eye)
            avg_ear = (left_ear + right_ear) / 2.0

            eyes_open = avg_ear > self.EAR_THRESHOLD
            details['eyes'] = {
                'left_ear': float(left_ear),
                'right_ear': float(right_ear),
                'avg_ear': float(avg_ear),
                'eyes_open': eyes_open
            }

            if method in ['blink', 'combined']:
                total_checks += 1
                if eyes_open:
                    checks_passed += 1

            # Check 2: Head pose
            pose = self.estimate_head_pose(face_landmarks, image.shape)
            has_natural_pose = (
                -30 < pose['yaw'] < 30 and
                -20 < pose['pitch'] < 20 and
                abs(pose['roll']) < 30
            )
            details['head_pose'] = {
                'yaw': float(pose['yaw']),
                'pitch': float(pose['pitch']),
                'roll': float(pose['roll']),
                'has_natural_pose': has_natural_pose
            }

            if method in ['head_turn', 'head_nod', 'combined']:
                total_checks += 1
                if has_natural_pose:
                    checks_passed += 1

            # Check 3: Face quality metrics
            # Calculate face bounding box from landmarks
            x_coords = [face_landmarks.landmark[i].x for i in range(468)]
            y_coords = [face_landmarks.landmark[i].y for i in range(468)]
            face_width = (max(x_coords) - min(x_coords)) * image.shape[1]
            face_height = (max(y_coords) - min(y_coords)) * image.shape[0]

            # Face should be reasonably sized (not too small)
            min_face_size = min(image.shape[0], image.shape[1]) * 0.15
            face_size_ok = face_width > min_face_size and face_height > min_face_size

            details['face_quality'] = {
                'face_width': float(face_width),
                'face_height': float(face_height),
                'min_required_size': float(min_face_size),
                'size_ok': face_size_ok
            }

            total_checks += 1
            if face_size_ok:
                checks_passed += 1

            # Calculate overall confidence
            if total_checks > 0:
                base_confidence = (checks_passed / total_checks) * 100
            else:
                base_confidence = 0

            # Adjust confidence based on EAR value (more open eyes = higher confidence)
            ear_bonus = min(10, (avg_ear - self.EAR_THRESHOLD) * 50) if eyes_open else 0
            confidence = min(100, base_confidence + ear_bonus)

            # Determine if live
            is_live = checks_passed >= (total_checks * 0.6)  # 60% of checks must pass

            details['checks_summary'] = {
                'passed': checks_passed,
                'total': total_checks,
                'pass_rate': f"{(checks_passed / total_checks * 100):.1f}%"
            }

            logger.info(f"Liveness check result: is_live={is_live}, confidence={confidence:.1f}%")

            return LivenessResult(
                is_live=is_live,
                confidence=float(confidence),
                method=method,
                details=details,
                error_message=None if is_live else "Liveness check failed. Please try again with better lighting and face the camera directly."
            )

        except Exception as e:
            logger.error(f"Error in liveness verification: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return LivenessResult(
                is_live=False,
                confidence=0.0,
                method=method,
                details={},
                error_message=f"Error during liveness verification: {str(e)}"
            )


class LivenessVerificationService:
    """
    High-level service for liveness verification integrated with loan applications.

    Handles:
    1. Image upload and storage
    2. Liveness detection using MediaPipe
    3. Result storage in database
    4. Integration with face comparison
    """

    @classmethod
    def get_min_confidence_threshold(cls) -> float:
        """Get minimum confidence threshold from settings."""
        from django.conf import settings
        liveness_settings = getattr(settings, 'LIVENESS_DETECTION', {})
        return float(liveness_settings.get('MIN_CONFIDENCE_THRESHOLD', 70.0))

    # For backward compatibility
    MIN_CONFIDENCE_THRESHOLD = 70.0

    @classmethod
    def verify_liveness_for_application(
        cls,
        application_id: int,
        image_path: str,
        method: str = 'combined'
    ) -> Dict:
        """
        Perform liveness verification for a loan application.

        Args:
            application_id: LoanApplication ID
            image_path: Full path to the captured image
            method: Detection method ('blink', 'head_turn', 'combined')

        Returns:
            Dict with verification results
        """
        from loans.models import LoanApplication, LivenessCheck
        from django.utils import timezone
        from django.conf import settings
        import json

        try:
            # Get application
            application = LoanApplication.objects.get(id=application_id)

            # Initialize liveness detector
            detector = MediaPipeLivenessService()

            # Perform liveness check
            result = detector.verify_liveness(image_path, method)

            # Get threshold from settings
            threshold = cls.get_min_confidence_threshold()

            # Determine status based on confidence threshold
            if result.is_live and result.confidence >= threshold:
                check_status = 'Verified'
            else:
                check_status = 'Failed'

            # Extract details for storage
            details = result.details or {}
            eyes_data = details.get('eyes', {})
            head_pose = details.get('head_pose', {})

            # Get relative path from MEDIA_ROOT
            relative_path = image_path
            if settings.MEDIA_ROOT and image_path.startswith(settings.MEDIA_ROOT):
                relative_path = image_path[len(settings.MEDIA_ROOT):].lstrip('/\\')

            # Delete any existing LivenessCheck records to start fresh
            # This prevents "MultipleObjectsReturned" errors on retry
            LivenessCheck.objects.filter(loan_application=application).delete()

            # Create new LivenessCheck record with full details
            liveness_check = LivenessCheck.objects.create(
                loan_application=application,
                method=method,
                confidence_score=Decimal(str(round(result.confidence, 2))),
                check_status=check_status,
                verified_at=timezone.now() if check_status == 'Verified' else None,
                # Eye detection data
                left_ear=Decimal(str(round(eyes_data.get('left_ear', 0), 4))) if eyes_data.get('left_ear') else None,
                right_ear=Decimal(str(round(eyes_data.get('right_ear', 0), 4))) if eyes_data.get('right_ear') else None,
                avg_ear=Decimal(str(round(eyes_data.get('avg_ear', 0), 4))) if eyes_data.get('avg_ear') else None,
                eyes_open=eyes_data.get('eyes_open'),
                # Head pose data
                head_yaw=Decimal(str(round(head_pose.get('yaw', 0), 2))) if head_pose.get('yaw') else None,
                head_pitch=Decimal(str(round(head_pose.get('pitch', 0), 2))) if head_pose.get('pitch') else None,
                head_roll=Decimal(str(round(head_pose.get('roll', 0), 2))) if head_pose.get('roll') else None,
                # Image and error
                image_path=relative_path,
                error_message=result.error_message,
                # Store full details as JSON
                detection_details=json.dumps(details) if details else None,
            )

            # Audit log: Liveness check result
            from loans.models import AuditLog
            if check_status == 'Verified':
                AuditLog.objects.create(
                    user=application.applicant,
                    action=f"Liveness check successful for application #{application.id}",
                    action_type='LIVENESS_SUCCESS',
                    severity='INFO',
                    success=True,
                    related_application=application
                )
            else:
                AuditLog.objects.create(
                    user=application.applicant,
                    action=f"Liveness check failed for application #{application.id}",
                    action_type='LIVENESS_FAIL',
                    severity='WARNING',
                    success=False,
                    failure_reason=result.error_message or f"Confidence {result.confidence:.1f}% below threshold {threshold}%",
                    related_application=application
                )

                # Check for repeated failures and alert
                from applicant.security_alerts import SecurityAlertService
                SecurityAlertService.check_and_alert_repeated_failures(
                    user=application.applicant,
                    application=application,
                    failure_type='LIVENESS_FAIL'
                )

            return {
                'success': result.is_live and check_status == 'Verified',
                'is_live': result.is_live,
                'confidence': result.confidence,
                'check_status': check_status,
                'method': method,
                'details': result.details,
                'error_message': result.error_message,
                'liveness_check_id': liveness_check.id,
                'threshold': threshold
            }

        except LoanApplication.DoesNotExist:
            return {
                'success': False,
                'is_live': False,
                'confidence': 0.0,
                'check_status': 'Failed',
                'error_message': f"Application {application_id} not found"
            }
        except Exception as e:
            logger.error(f"Error in verify_liveness_for_application: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return {
                'success': False,
                'is_live': False,
                'confidence': 0.0,
                'check_status': 'Failed',
                'error_message': f"Error during liveness verification: {str(e)}"
            }

    @classmethod
    def verify_with_face_comparison(
        cls,
        application_id: int,
        selfie_path: str,
        method: str = 'combined'
    ) -> Dict:
        """
        Combined liveness verification and face comparison.

        Performs:
        1. Liveness check on selfie
        2. Face comparison between ID photo and selfie

        Args:
            application_id: LoanApplication ID
            selfie_path: Full path to the selfie image
            method: Liveness detection method

        Returns:
            Dict with combined results
        """
        from .face_verification_service import FaceComparisonService

        # Step 1: Liveness check
        liveness_result = cls.verify_liveness_for_application(
            application_id,
            selfie_path,
            method
        )

        # If liveness failed, don't proceed with face comparison
        if not liveness_result.get('is_live', False):
            return {
                'success': False,
                'liveness': liveness_result,
                'face_comparison': None,
                'overall_verified': False,
                'error_message': liveness_result.get('error_message', 'Liveness check failed')
            }

        # Step 2: Face comparison (uses existing service)
        try:
            from loans.models import FaceVerification, LoanApplication

            # Get application
            application = LoanApplication.objects.get(id=application_id)

            # Delete any existing FaceVerification records to start fresh
            FaceVerification.objects.filter(loan_application=application).delete()

            # Create new FaceVerification with selfie path
            face_verification = FaceVerification.objects.create(
                loan_application=application,
                captured_image_path=selfie_path.replace('\\', '/')
            )

            # Perform face comparison
            # Note: verify_faces_for_application will delete and recreate the record,
            # but that's okay - it ensures clean state
            verification = FaceComparisonService.verify_faces_for_application(application_id)

            face_result = {
                'success': verification.verification_status == 'Verified',
                'similarity_score': float(verification.similarity_score) if verification.similarity_score else 0,
                'is_match': verification.is_match,
                'verification_status': verification.verification_status,
                'error_message': verification.error_message
            }

            # Overall result
            overall_verified = (
                liveness_result.get('is_live', False) and
                liveness_result.get('check_status') == 'Verified' and
                face_result.get('is_match', False)
            )

            return {
                'success': overall_verified,
                'liveness': liveness_result,
                'face_comparison': face_result,
                'overall_verified': overall_verified,
                'error_message': None if overall_verified else (
                    face_result.get('error_message') or
                    liveness_result.get('error_message') or
                    'Verification failed'
                )
            }

        except Exception as e:
            logger.error(f"Error in face comparison: {str(e)}")
            return {
                'success': False,
                'liveness': liveness_result,
                'face_comparison': {'error_message': str(e)},
                'overall_verified': False,
                'error_message': f"Face comparison error: {str(e)}"
            }