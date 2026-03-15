"""
Rate Limiting Throttles for Applicant API Endpoints

Implements rate limiting to prevent abuse and protect expensive operations:
- Face verification (computationally expensive DeepFace processing)
- Liveness checks (video processing with MediaPipe)
- Document uploads (file I/O and potential OCR processing)

Uses Django REST Framework's throttling system with per-user rate limits.
Rates are configurable via settings.
"""

from rest_framework.throttling import UserRateThrottle, AnonRateThrottle


class FaceVerificationThrottle(UserRateThrottle):
    """
    Rate limit for face verification endpoints.

    Limits face verification attempts to prevent:
    - Brute force attacks with different photos
    - Server resource exhaustion from DeepFace processing
    - Excessive retry attempts

    Default: 5 attempts per hour per user
    """
    rate = '5/hour'
    scope = 'face_verification'


class LivenessCheckThrottle(UserRateThrottle):
    """
    Rate limit for liveness check endpoints.

    Stricter limit due to:
    - Expensive video processing (frame extraction, MediaPipe analysis)
    - Large file uploads (videos can be 20-50MB)
    - Multiple frames analyzed per video (5-8 frames)

    Default: 3 attempts per hour per user
    """
    rate = '3/hour'
    scope = 'liveness_check'


class DocumentUploadThrottle(UserRateThrottle):
    """
    Rate limit for document upload endpoints.

    Moderate limit to allow legitimate uploads while preventing:
    - Spam uploads
    - Storage exhaustion attacks
    - Excessive file I/O

    Default: 10 uploads per hour per user
    """
    rate = '10/hour'
    scope = 'document_upload'


class IDOCRThrottle(UserRateThrottle):
    """
    Rate limit for ID OCR scanning endpoints.

    Protects expensive OCR operations (Tesseract processing).

    Default: 5 scans per hour per user
    """
    rate = '5/hour'
    scope = 'id_ocr'


class BurstRateThrottle(UserRateThrottle):
    """
    Burst rate throttle for general API endpoints.

    Prevents rapid-fire requests in short time windows.

    Default: 30 requests per minute
    """
    rate = '30/min'
    scope = 'burst'


class SustainedRateThrottle(UserRateThrottle):
    """
    Sustained rate throttle for general API endpoints.

    Prevents sustained high-volume requests over longer periods.

    Default: 100 requests per hour
    """
    rate = '100/hour'
    scope = 'sustained'


# Anonymous user throttles (for public endpoints, if any)
class AnonBurstRateThrottle(AnonRateThrottle):
    """
    Burst rate for anonymous/unauthenticated users.

    More restrictive than authenticated users.

    Default: 10 requests per minute
    """
    rate = '10/min'
    scope = 'anon_burst'


class AnonSustainedRateThrottle(AnonRateThrottle):
    """
    Sustained rate for anonymous/unauthenticated users.

    Default: 30 requests per hour
    """
    rate = '30/hour'
    scope = 'anon_sustained'
