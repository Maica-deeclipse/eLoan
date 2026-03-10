"""
Face Verification Service
Handles face detection and comparison using OpenCV and DeepFace
"""

import os
import cv2
import logging
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from deepface import DeepFace
from PIL import Image
import numpy as np

from loans.models import FaceVerification, LoanApplication, LoanDocument

logger = logging.getLogger('face_verification')


class FaceComparisonService:
    """
    Service for face detection and comparison using OpenCV Haar Cascades and DeepFace.

    Dependencies:
    - opencv-python (cv2)
    - deepface
    - tf-keras (TensorFlow backend)
    """

    # Haar Cascade for face detection
    FACE_CASCADE_PATH = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'

    # DeepFace configuration
    MODEL_NAME = 'ArcFace'  # Options: VGG-Face, Facenet, OpenFace, DeepFace, DeepID, ArcFace, Dlib, SFace
    DISTANCE_METRIC = 'cosine'  # Options: cosine, euclidean, euclidean_l2
    DETECTOR_BACKEND = 'opencv'  # Options: opencv, ssd, dlib, mtcnn, retinaface

    # Thresholds from DeepFace documentation
    SIMILARITY_THRESHOLDS = {
        'ArcFace': {'cosine': 0.68, 'euclidean': 4.15, 'euclidean_l2': 1.13},
        'Facenet': {'cosine': 0.40, 'euclidean': 10, 'euclidean_l2': 0.80},
        'VGG-Face': {'cosine': 0.40, 'euclidean': 0.60, 'euclidean_l2': 0.86},
    }

    @classmethod
    def get_threshold(cls):
        """Get threshold for current model and distance metric"""
        return cls.SIMILARITY_THRESHOLDS.get(cls.MODEL_NAME, {}).get(cls.DISTANCE_METRIC, 0.68)

    @classmethod
    def detect_face(cls, image_path):
        """
        Detect face in image using Haar Cascade.

        Args:
            image_path (str): Path to image file

        Returns:
            dict: {
                'success': bool,
                'face_count': int,
                'face_region': (x, y, w, h) or None,
                'message': str
            }
        """
        try:
            logger.info(f"Detecting face in: {image_path}")

            # Load image
            image = cv2.imread(image_path)
            if image is None:
                return {'success': False, 'face_count': 0, 'face_region': None,
                       'message': 'Could not load image'}

            # Convert to grayscale for face detection
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

            # Load Haar Cascade classifier
            face_cascade = cv2.CascadeClassifier(cls.FACE_CASCADE_PATH)

            # Detect faces
            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30)
            )

            face_count = len(faces)
            logger.info(f"Detected {face_count} face(s)")

            if face_count == 0:
                return {'success': False, 'face_count': 0, 'face_region': None,
                       'message': 'No face detected in image'}

            # If multiple faces, use the largest one
            if face_count > 1:
                logger.warning(f"Multiple faces detected ({face_count}). Using largest face.")
                faces = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)

            face_region = tuple(faces[0])  # (x, y, w, h)

            return {
                'success': True,
                'face_count': face_count,
                'face_region': face_region,
                'message': 'Face detected successfully'
            }

        except Exception as e:
            logger.error(f"Error detecting face: {str(e)}")
            return {'success': False, 'face_count': 0, 'face_region': None,
                   'message': f'Error: {str(e)}'}

    @classmethod
    def extract_face_from_document(cls, document_path, output_dir):
        """
        Extract face from ID document image and save cropped version.

        Args:
            document_path (str): Path to ID document image
            output_dir (str): Directory to save cropped face

        Returns:
            dict: {
                'success': bool,
                'face_path': str or None,
                'coordinates': dict or None,
                'message': str
            }
        """
        try:
            logger.info(f"Extracting face from document: {document_path}")

            # Detect face
            detection_result = cls.detect_face(document_path)
            if not detection_result['success']:
                return {
                    'success': False,
                    'face_path': None,
                    'coordinates': None,
                    'message': detection_result['message']
                }

            # Load image
            image = cv2.imread(document_path)
            x, y, w, h = detection_result['face_region']

            # Add padding around face (20%)
            padding = int(max(w, h) * 0.2)
            x1 = max(0, x - padding)
            y1 = max(0, y - padding)
            x2 = min(image.shape[1], x + w + padding)
            y2 = min(image.shape[0], y + h + padding)

            # Crop face with padding
            face_crop = image[y1:y2, x1:x2]

            # Create output directory if it doesn't exist
            os.makedirs(output_dir, exist_ok=True)

            # Save cropped face
            output_filename = 'id_face.jpg'
            output_path = os.path.join(output_dir, output_filename)
            cv2.imwrite(output_path, face_crop)

            logger.info(f"Face extracted and saved to: {output_path}")

            return {
                'success': True,
                'face_path': output_path,
                'coordinates': {'x': x, 'y': y, 'width': w, 'height': h},
                'message': 'Face extracted successfully'
            }

        except Exception as e:
            logger.error(f"Error extracting face from document: {str(e)}")
            return {
                'success': False,
                'face_path': None,
                'coordinates': None,
                'message': f'Error: {str(e)}'
            }

    @classmethod
    def compare_faces(cls, id_photo_path, selfie_path):
        """
        Compare two face images using DeepFace.

        Args:
            id_photo_path (str): Path to ID photo (or extracted face from ID)
            selfie_path (str): Path to selfie

        Returns:
            dict: {
                'success': bool,
                'verified': bool,
                'distance': float,
                'threshold': float,
                'similarity_percentage': float,
                'model': str,
                'distance_metric': str,
                'message': str
            }
        """
        try:
            logger.info(f"Comparing faces: ID={id_photo_path}, Selfie={selfie_path}")

            # Verify both images exist
            if not os.path.exists(id_photo_path):
                return {'success': False, 'verified': False, 'message': 'ID photo not found'}
            if not os.path.exists(selfie_path):
                return {'success': False, 'verified': False, 'message': 'Selfie not found'}

            # Perform face verification using DeepFace
            result = DeepFace.verify(
                img1_path=id_photo_path,
                img2_path=selfie_path,
                model_name=cls.MODEL_NAME,
                distance_metric=cls.DISTANCE_METRIC,
                detector_backend=cls.DETECTOR_BACKEND,
                enforce_detection=True
            )

            # Extract results
            distance = result.get('distance', 0)
            threshold = result.get('threshold', cls.get_threshold())
            verified = result.get('verified', False)

            # Convert distance to similarity percentage (0-100)
            # For cosine distance: similarity = (1 - distance) * 100
            # Clamp between 0-100
            if cls.DISTANCE_METRIC == 'cosine':
                similarity_percentage = max(0, min(100, (1 - distance) * 100))
            else:
                # For other metrics, use threshold-based calculation
                similarity_percentage = max(0, min(100, (1 - (distance / threshold)) * 100))

            logger.info(f"Comparison result: verified={verified}, distance={distance}, "
                       f"threshold={threshold}, similarity={similarity_percentage}%")

            return {
                'success': True,
                'verified': verified,
                'distance': float(distance),
                'threshold': float(threshold),
                'similarity_percentage': float(similarity_percentage),
                'model': cls.MODEL_NAME,
                'distance_metric': cls.DISTANCE_METRIC,
                'message': 'Face comparison completed successfully'
            }

        except ValueError as e:
            # DeepFace raises ValueError when no face is detected
            logger.error(f"Face detection error in DeepFace: {str(e)}")
            return {
                'success': False,
                'verified': False,
                'distance': None,
                'threshold': None,
                'similarity_percentage': 0.0,
                'model': cls.MODEL_NAME,
                'distance_metric': cls.DISTANCE_METRIC,
                'message': f'Face detection failed: {str(e)}'
            }
        except Exception as e:
            logger.error(f"Error comparing faces: {str(e)}")
            return {
                'success': False,
                'verified': False,
                'distance': None,
                'threshold': None,
                'similarity_percentage': 0.0,
                'model': cls.MODEL_NAME,
                'distance_metric': cls.DISTANCE_METRIC,
                'message': f'Error: {str(e)}'
            }

    @classmethod
    def verify_faces_for_application(cls, application_id):
        """
        Main method: Extract faces from ID and selfie, compare them, save results.

        Args:
            application_id (int): LoanApplication ID

        Returns:
            FaceVerification: Updated FaceVerification object
        """
        try:
            logger.info(f"Starting face verification for application {application_id}")

            # Get application
            application = LoanApplication.objects.get(id=application_id)

            # Get or create FaceVerification record
            face_verification, created = FaceVerification.objects.get_or_create(
                loan_application=application,
                defaults={'verification_status': 'Processing'}
            )

            # If not created, update status to Processing
            if not created:
                face_verification.verification_status = 'Processing'
                face_verification.save()

            # Get ID document (valid_id)
            try:
                id_document = LoanDocument.objects.filter(
                    loan_application=application,
                    document_type='valid_id'
                ).latest('uploaded_at')
                id_document_path = os.path.join(settings.MEDIA_ROOT, id_document.file_path)
            except LoanDocument.DoesNotExist:
                face_verification.error_message = "ID document not found. Please upload your valid ID first."
                face_verification.verification_status = 'Failed'
                face_verification.processed_at = timezone.now()
                face_verification.save()
                logger.error(f"No valid_id document found for application {application_id}")
                return face_verification

            # Get selfie path
            if not face_verification.captured_image_path:
                face_verification.error_message = "Selfie not found. Please capture your selfie."
                face_verification.verification_status = 'Failed'
                face_verification.processed_at = timezone.now()
                face_verification.save()
                logger.error(f"No selfie found for application {application_id}")
                return face_verification

            selfie_path = os.path.join(settings.MEDIA_ROOT, face_verification.captured_image_path)

            # Create faces directory for extracted faces
            faces_dir = os.path.join(settings.MEDIA_ROOT, f'applicant/faces/{application_id}')

            # Step 1: Extract face from ID document
            logger.info("Extracting face from ID document...")
            id_face_result = cls.extract_face_from_document(id_document_path, faces_dir)

            if not id_face_result['success']:
                face_verification.error_message = id_face_result['message']
                face_verification.face_detected_in_id = False
                face_verification.verification_status = 'Failed'
                face_verification.processed_at = timezone.now()
                face_verification.save()
                logger.error(f"Failed to extract face from ID: {id_face_result['message']}")
                return face_verification

            face_verification.face_detected_in_id = True
            # Store relative path from MEDIA_ROOT
            id_face_relative_path = os.path.relpath(id_face_result['face_path'], settings.MEDIA_ROOT)
            face_verification.id_photo_path = id_face_relative_path

            # Step 2: Detect face in selfie
            logger.info("Detecting face in selfie...")
            selfie_detection = cls.detect_face(selfie_path)

            if not selfie_detection['success']:
                face_verification.error_message = f"Selfie: {selfie_detection['message']}"
                face_verification.face_detected_in_selfie = False
                face_verification.verification_status = 'Failed'
                face_verification.processed_at = timezone.now()
                face_verification.save()
                logger.error(f"No face detected in selfie: {selfie_detection['message']}")
                return face_verification

            face_verification.face_detected_in_selfie = True

            # Step 3: Compare faces using DeepFace
            logger.info("Comparing faces with DeepFace...")
            comparison_result = cls.compare_faces(id_face_result['face_path'], selfie_path)

            if not comparison_result['success']:
                face_verification.error_message = comparison_result['message']
                face_verification.verification_status = 'Failed'
                face_verification.processed_at = timezone.now()
                face_verification.save()
                logger.error(f"Face comparison failed: {comparison_result['message']}")
                return face_verification

            # Store comparison results
            face_verification.similarity_score = Decimal(str(comparison_result['similarity_percentage']))
            face_verification.comparison_model = comparison_result['model']
            face_verification.comparison_distance = Decimal(str(comparison_result['distance'])) if comparison_result['distance'] is not None else None
            face_verification.comparison_threshold = Decimal(str(comparison_result['threshold'])) if comparison_result['threshold'] is not None else None

            # Determine if faces match based on threshold (80% similarity)
            auto_approve_threshold = getattr(settings, 'FACE_VERIFICATION', {}).get('AUTO_APPROVE_THRESHOLD', 80)
            is_match = comparison_result['similarity_percentage'] >= auto_approve_threshold
            face_verification.is_match = is_match

            # Set verification status
            if is_match:
                face_verification.verification_status = 'Verified'
                face_verification.verified_at = timezone.now()
                face_verification.error_message = None
                logger.info(f"Face verification PASSED: {comparison_result['similarity_percentage']}% similarity")
            else:
                face_verification.verification_status = 'Failed'
                face_verification.error_message = (
                    f"Face verification failed. Similarity score ({comparison_result['similarity_percentage']:.1f}%) "
                    f"is below the required threshold ({auto_approve_threshold}%)."
                )
                logger.warning(f"Face verification FAILED: {comparison_result['similarity_percentage']}% similarity")

            face_verification.processed_at = timezone.now()
            face_verification.save()

            return face_verification

        except LoanApplication.DoesNotExist:
            logger.error(f"LoanApplication {application_id} not found")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in verify_faces_for_application: {str(e)}")
            # Try to update face verification record if it exists
            try:
                face_verification.error_message = f"System error: {str(e)}"
                face_verification.verification_status = 'Failed'
                face_verification.processed_at = timezone.now()
                face_verification.save()
            except:
                pass
            raise
