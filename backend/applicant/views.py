"""
Applicant Module API Views

REST API endpoints for the React Native mobile app.
All endpoints require JWT authentication and Applicant role.
"""

from decimal import Decimal
import os
import uuid
import logging

from django.conf import settings
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.authentication import JWTAuthentication

from shared.services.pdf_service import LoanApplicationPDFService
from loans.models import AuditLog

from .services import (
    ApplicantDashboardService,
    LoanApplicationService,
    CalculationService,
    DocumentService,
    FaceVerificationService,
    ProfileService,
    CoMakerService,
    NotificationService
)
from .face_verification_service import FaceComparisonService
from .models import ESignature
from .utils import get_client_ip, DocumentTypes, ApplicationStatuses

logger = logging.getLogger(__name__)


class ApplicantBaseView(APIView):
    """
    Base view for all applicant endpoints.
    Requires JWT authentication and Applicant role.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def check_permissions(self, request):
        """Check if user has Applicant role."""
        super().check_permissions(request)
        user = request.user
        if not user.role or user.role.name != 'Applicant':
            self.permission_denied(
                request,
                message='You do not have permission to access this interface.'
            )


# =============================================================================
# Dashboard API
# =============================================================================
class DashboardView(ApplicantBaseView):
    """GET /api/applicant/dashboard/"""

    def get(self, request):
        user = request.user

        stats = ApplicantDashboardService.get_dashboard_stats(user)
        recent_apps = ApplicantDashboardService.get_recent_applications(user, limit=5)
        notifications = ApplicantDashboardService.get_notifications_preview(user, limit=5)

        return Response({
            'stats': stats,
            'recent_applications': [
                {
                    'id': app.id,
                    'loan_type': app.loan_type.loan_name,
                    'amount_requested': str(app.amount_requested),
                    'status': app.current_status.status_name,
                    'application_date': app.application_date.isoformat(),
                }
                for app in recent_apps
            ],
            'notifications': [
                {
                    'id': n.id,
                    'title': n.title,
                    'message': n.message[:100],
                    'notification_type': n.notification_type,
                    'created_at': n.created_at.isoformat(),
                }
                for n in notifications
            ],
        })


class CanApplyView(ApplicantBaseView):
    """GET /api/applicant/can-apply/"""

    def get(self, request):
        result = LoanApplicationService.check_can_apply(request.user)
        return Response(result)


# =============================================================================
# Loan Types API
# =============================================================================
class LoanTypeListView(ApplicantBaseView):
    """GET /api/applicant/loan-types/"""

    def get(self, request):
        loan_types = LoanApplicationService.get_active_loan_types()
        return Response({'loan_types': loan_types})


class LoanTypeDetailView(ApplicantBaseView):
    """GET /api/applicant/loan-types/<id>/"""

    def get(self, request, pk):
        loan_type = LoanApplicationService.get_loan_type_detail(pk)
        if not loan_type:
            return Response(
                {'error': 'Loan type not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(loan_type)


# =============================================================================
# Applications API
# =============================================================================
class ApplicationListView(ApplicantBaseView):
    """GET /api/applicant/applications/"""

    def get(self, request):
        status_filter = request.query_params.get('status')
        applications = LoanApplicationService.get_user_applications(
            request.user,
            status_filter=status_filter
        )

        return Response({
            'applications': [
                {
                    'id': app.id,
                    'loan_type_id': app.loan_type.id,
                    'loan_type': app.loan_type.loan_name,
                    'amount_requested': str(app.amount_requested),
                    'term_months': app.term_months,
                    'monthly_amortization': str(app.monthly_amortization),
                    'total_payable': str(app.total_payable),
                    'status': app.current_status.status_name,
                    'application_date': app.application_date.isoformat(),
                    'remaining_balance': str(app.remaining_balance),
                    'total_paid': str(app.total_paid),
                }
                for app in applications
            ]
        })


class CreateApplicationView(ApplicantBaseView):
    """POST /api/applicant/applications/"""

    def post(self, request):
        loan_type_id = request.data.get('loan_type_id')
        if not loan_type_id:
            return Response(
                {'error': 'Loan type is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # If an editable application already exists for this loan type, resume it.
        existing = LoanApplicationService.get_editable_application_for_loan_type(
            request.user,
            loan_type_id,
        )
        if existing:
            return Response({
                'id': existing.id,
                'loan_type': {
                    'id': existing.loan_type.id,
                    'loan_name': existing.loan_type.loan_name,
                },
                'status': existing.current_status.status_name,
                'message': 'Existing application resumed',
            }, status=status.HTTP_200_OK)

        # Check if user can apply for a brand-new application
        can_apply = LoanApplicationService.check_can_apply(request.user)
        if not can_apply['can_apply']:
            return Response(
                {'error': can_apply['reason']},
                status=status.HTTP_400_BAD_REQUEST
            )

        application, error = LoanApplicationService.create_draft_application(
            request.user,
            loan_type_id
        )

        if error:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'id': application.id,
            'loan_type': {
                'id': application.loan_type.id,
                'loan_name': application.loan_type.loan_name,
            },
            'status': application.current_status.status_name,
            'message': 'Application created successfully',
        }, status=status.HTTP_201_CREATED)


class ApplicationDetailView(ApplicantBaseView):
    """GET /api/applicant/applications/<id>/"""

    def get(self, request, pk):
        application = LoanApplicationService.get_application_by_id(pk, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get co-makers
        comakers = []
        for cm in application.comakers.all():
            comaker_data = {
                'id': cm.id,
                'user_id': cm.user.id,
                'user_name': f"{cm.user.firstname} {cm.user.lastname}",
                'user_email': cm.user.email,
            }
            try:
                info = cm.detailed_info
                comaker_data.update({
                    'full_name': info.full_name,
                    'relationship': info.relationship_to_applicant,
                    'contact_number': info.contact_number,
                    'consent_given': info.consent_given,
                })
            except:
                pass
            comakers.append(comaker_data)

        # Get documents
        documents = [
            {
                'id': doc.id,
                'document_type': doc.document_type,
                'document_name': DocumentTypes.DISPLAY_NAMES.get(doc.document_type, doc.document_type),
                'file_path': doc.file_path,
                'verified': doc.verified,
                'uploaded_at': doc.uploaded_at.isoformat(),
            }
            for doc in application.documents.all()
        ]

        # Get verification status
        verification_status = FaceVerificationService.get_verification_status(application)

        # Get e-signature status
        esignature = None
        try:
            esig = application.esignature
            esignature = {
                'signed_at': esig.signed_at.isoformat(),
                'terms_accepted': esig.terms_accepted,
            }
        except ESignature.DoesNotExist:
            pass

        return Response({
            'id': application.id,
            'loan_type': {
                'id': application.loan_type.id,
                'loan_name': application.loan_type.loan_name,
                'interest_rate': str(application.loan_type.interest_rate),
            },
            'amount_requested': str(application.amount_requested),
            'term_months': application.term_months,
            'monthly_amortization': str(application.monthly_amortization),
            'total_payable': str(application.total_payable),
            'purpose': application.purpose,
            'status': application.current_status.status_name,
            'application_date': application.application_date.isoformat(),
            'remaining_balance': str(application.remaining_balance),
            'total_paid': str(application.total_paid),
            'comakers': comakers,
            'documents': documents,
            'face_verification': {
                'completed': verification_status['face_capture']['completed'],
                'verified': verification_status['face_capture']['verified'],
            },
            'liveness_check': {
                'completed': verification_status['liveness_check']['completed'],
                'verified': verification_status['liveness_check']['verified'],
            },
            'esignature': esignature,
        })


class UpdateApplicationStepView(ApplicantBaseView):
    """PUT /api/applicant/applications/<id>/step/<step_number>/"""

    def put(self, request, pk, step_number):
        application = LoanApplicationService.get_application_by_id(pk, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        success, error = LoanApplicationService.update_application_step(
            application,
            int(step_number),
            request.data
        )

        if not success:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'message': 'Step updated successfully',
            'monthly_amortization': str(application.monthly_amortization),
            'total_payable': str(application.total_payable),
        })


class SubmitApplicationView(ApplicantBaseView):
    """POST /api/applicant/applications/<id>/submit/"""

    def post(self, request, pk):
        application = LoanApplicationService.get_application_by_id(pk, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        ip_address = get_client_ip(request)
        success, errors = LoanApplicationService.submit_application(
            application,
            request.user,
            ip_address
        )

        if not success:
            return Response(
                {'errors': errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'message': 'Application submitted successfully',
            'status': application.current_status.status_name,
        })


class WithdrawApplicationView(ApplicantBaseView):
    """POST /api/applicant/applications/<id>/withdraw/"""

    def post(self, request, pk):
        application = LoanApplicationService.get_application_by_id(pk, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        reason = request.data.get('reason', '')
        success, error = LoanApplicationService.withdraw_application(
            application,
            request.user,
            reason
        )

        if not success:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'message': 'Application withdrawn successfully',
        })


class DeleteDraftApplicationView(ApplicantBaseView):
    """POST /api/applicant/applications/<id>/delete/"""

    def post(self, request, pk):
        application = LoanApplicationService.get_application_by_id(pk, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        success, error = LoanApplicationService.delete_draft_application(
            application,
            request.user
        )

        if not success:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'message': 'Draft application deleted successfully',
        })


class DownloadApplicationPDFView(ApplicantBaseView):
    """
    GET /api/applicant/applications/<id>/download-pdf/

    Download PDF of an approved loan application.
    Only allows download of the applicant's own approved applications.
    """

    def get(self, request, pk):
        # Get application with ownership check
        application = LoanApplicationService.get_application_by_id(pk, request.user)

        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if application is approved
        if not LoanApplicationPDFService.can_download(application):
            return Response(
                {'error': 'PDF download is only available for approved applications'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate PDF
        pdf_buffer = LoanApplicationPDFService.generate_pdf(application)
        filename = LoanApplicationPDFService.get_filename(application)

        # Create audit log
        AuditLog.objects.create(
            user=request.user,
            action=f"Downloaded PDF for loan application #{application.id}"
        )

        # Return file response
        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename=filename,
            content_type='application/pdf'
        )


# =============================================================================
# Documents API
# =============================================================================
class DocumentListView(ApplicantBaseView):
    """GET /api/applicant/applications/<app_id>/documents/"""

    def get(self, request, app_id):
        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        documents = DocumentService.get_application_documents(application)

        return Response({
            'documents': [
                {
                    'id': doc.id,
                    'document_type': doc.document_type,
                    'document_name': DocumentTypes.DISPLAY_NAMES.get(doc.document_type, doc.document_type),
                    'file_path': doc.file_path,
                    'verified': doc.verified,
                    'uploaded_at': doc.uploaded_at.isoformat(),
                }
                for doc in documents
            ],
            'required_documents': [
                {
                    'type': dt,
                    'name': DocumentTypes.DISPLAY_NAMES.get(dt, dt),
                    'uploaded': any(d.document_type == dt for d in documents),
                }
                for dt in DocumentTypes.REQUIRED_DOCUMENTS
            ]
        })


class DocumentUploadView(ApplicantBaseView):
    """POST /api/applicant/applications/<app_id>/documents/upload/"""
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, app_id):
        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        document_type = request.data.get('document_type')
        file = request.FILES.get('file')

        if not document_type:
            return Response(
                {'error': 'Document type is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not file:
            return Response(
                {'error': 'File is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save file
        ext = os.path.splitext(file.name)[1].lower()
        filename = f"{document_type}_{uuid.uuid4().hex[:12]}{ext}"
        file_path = f"applicant/documents/{application.id}/{filename}"

        # Ensure directory exists
        full_dir = os.path.join(settings.MEDIA_ROOT, f"applicant/documents/{application.id}")
        os.makedirs(full_dir, exist_ok=True)

        # Save file
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        with open(full_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)

        document, error = DocumentService.upload_document(
            application,
            document_type,
            file_path,
            request.user
        )

        if error:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'id': document.id,
            'document_type': document.document_type,
            'file_path': document.file_path,
            'message': 'Document uploaded successfully',
        }, status=status.HTTP_201_CREATED)


class DocumentDetailView(ApplicantBaseView):
    """GET/DELETE /api/applicant/documents/<id>/"""

    def delete(self, request, pk):
        success, error = DocumentService.delete_document(pk, request.user)

        if not success:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({'message': 'Document deleted successfully'})


class DocumentReplaceView(ApplicantBaseView):
    """PUT /api/applicant/documents/<id>/replace/"""
    parser_classes = [MultiPartParser, FormParser]

    def put(self, request, pk):
        file = request.FILES.get('file')

        if not file:
            return Response(
                {'error': 'File is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save new file
        ext = os.path.splitext(file.name)[1].lower()
        filename = f"replaced_{uuid.uuid4().hex[:12]}{ext}"
        file_path = f"applicant/documents/{filename}"

        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)

        document, error = DocumentService.replace_document(pk, file_path, request.user)

        if error:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'id': document.id,
            'file_path': document.file_path,
            'message': 'Document replaced successfully',
        })


# =============================================================================
# ID OCR Scanning API
# =============================================================================
class IDOCRScanView(ApplicantBaseView):
    """
    POST /api/applicant/applications/<app_id>/id-ocr-scan/

    Upload an ID image and extract information using OCR.
    Supports: Driver's License, UMID, Passport

    Request:
        - image: File (required) - ID image to scan
        - profile_name: String (optional) - Name to validate against

    Response:
        - success: Boolean
        - id_type: String (drivers_license, umid, passport, unknown)
        - extracted_data: Object with full_name, id_number, birthdate, address
        - confidence_scores: Object with confidence for each field
        - overall_confidence: Float (0-1)
        - name_validation: Object (if profile_name provided)
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, app_id):
        from .ocr_service import IDOCRService

        # Verify application ownership
        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Validate request
        image = request.FILES.get('image')
        if not image:
            return Response(
                {'error': 'Image file is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.webp']
        ext = os.path.splitext(image.name)[1].lower()
        if ext not in allowed_extensions:
            return Response(
                {'error': f'Invalid file type. Allowed: {", ".join(allowed_extensions)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save image to disk
        filename = f"id_scan_{uuid.uuid4().hex[:12]}{ext}"
        file_path = f"applicant/id_scans/{application.id}/{filename}"

        full_dir = os.path.join(settings.MEDIA_ROOT, f"applicant/id_scans/{application.id}")
        os.makedirs(full_dir, exist_ok=True)

        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        with open(full_path, 'wb+') as destination:
            for chunk in image.chunks():
                destination.write(chunk)

        # Get profile name for validation (optional)
        profile_name = request.data.get('profile_name')
        if not profile_name:
            # Try to get from user's profile
            user = request.user
            profile_name = f"{user.firstname} {user.lastname}".strip()

        # Process OCR
        try:
            result = IDOCRService.process_id_image(full_path, profile_name)

            # Add image path to response
            result['image_path'] = file_path

            if result.get('success'):
                return Response(result, status=status.HTTP_200_OK)
            else:
                return Response(result, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        except Exception as e:
            import traceback
            logger.exception(f"OCR processing error: {str(e)}")
            return Response({
                'success': False,
                'error': f'OCR processing failed: {str(e)}',
                'message': 'Could not process ID. Please ensure the image is clear and try again.',
                'debug_info': traceback.format_exc() if settings.DEBUG else None,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# Face Verification API
# =============================================================================
class FaceCaptureView(ApplicantBaseView):
    """POST /api/applicant/applications/<app_id>/face-capture/"""
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, app_id):
        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        image = request.FILES.get('image')
        if not image:
            return Response(
                {'error': 'Image is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save image
        ext = os.path.splitext(image.name)[1].lower()
        filename = f"face_{uuid.uuid4().hex[:12]}{ext}"
        file_path = f"applicant/faces/{application.id}/{filename}"

        full_dir = os.path.join(settings.MEDIA_ROOT, f"applicant/faces/{application.id}")
        os.makedirs(full_dir, exist_ok=True)

        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        with open(full_path, 'wb+') as destination:
            for chunk in image.chunks():
                destination.write(chunk)

        # Save face capture (creates or updates FaceVerification record)
        verification = FaceVerificationService.save_face_capture(
            application,
            file_path,
            request.user,
            match_score=None  # Will be set by face comparison service
        )

        # Perform face comparison using DeepFace
        try:
            verification = FaceComparisonService.verify_faces_for_application(application.id)

            # Build response based on verification result
            response_data = {
                'id': verification.id,
                'verification_status': verification.verification_status,
                'similarity_score': float(verification.similarity_score) if verification.similarity_score else None,
                'is_match': verification.is_match,
                'face_detected_in_id': verification.face_detected_in_id,
                'face_detected_in_selfie': verification.face_detected_in_selfie,
                'error_message': verification.error_message,
            }

            # Determine response status code
            if verification.verification_status == 'Verified':
                response_data['message'] = f'Face verification successful! Similarity: {verification.similarity_score}%'
                return Response(response_data, status=status.HTTP_201_CREATED)
            else:
                response_data['message'] = verification.error_message or 'Face verification failed'
                return Response(response_data, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        except Exception as e:
            return Response({
                'error': f'Face verification error: {str(e)}',
                'message': 'An error occurred during face verification. Please try again.',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RetryFaceVerificationView(ApplicantBaseView):
    """POST /api/applicant/applications/<app_id>/face-verification/retry/"""

    def post(self, request, app_id):
        """
        Retry face verification without re-uploading images.
        Uses existing selfie and ID document from previous attempt.
        """
        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Perform face comparison
        try:
            verification = FaceComparisonService.verify_faces_for_application(application.id)

            # Build response
            response_data = {
                'id': verification.id,
                'verification_status': verification.verification_status,
                'similarity_score': float(verification.similarity_score) if verification.similarity_score else None,
                'is_match': verification.is_match,
                'face_detected_in_id': verification.face_detected_in_id,
                'face_detected_in_selfie': verification.face_detected_in_selfie,
                'error_message': verification.error_message,
            }

            if verification.verification_status == 'Verified':
                response_data['message'] = f'Face verification successful! Similarity: {verification.similarity_score}%'
                return Response(response_data, status=status.HTTP_200_OK)
            else:
                response_data['message'] = verification.error_message or 'Face verification failed'
                return Response(response_data, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        except Exception as e:
            return Response({
                'error': f'Face verification error: {str(e)}',
                'message': 'An error occurred during face verification. Please try again.',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LivenessCheckView(ApplicantBaseView):
    """POST /api/applicant/applications/<app_id>/liveness-check/"""
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, app_id):
        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        method = request.data.get('method', 'blink')
        image = request.FILES.get('image')

        if not image:
            return Response(
                {'error': 'Image is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save liveness check (in production, you'd integrate with a liveness detection service)
        check = FaceVerificationService.save_liveness_check(
            application,
            method,
            Decimal('98.00'),  # Placeholder confidence score
            request.user
        )

        # Auto-verify for now
        check.check_status = 'Verified'
        check.verified_at = timezone.now()
        check.save()

        return Response({
            'id': check.id,
            'method': check.method,
            'status': check.check_status,
            'message': 'Liveness check completed successfully',
        }, status=status.HTTP_201_CREATED)


class VerificationStatusView(ApplicantBaseView):
    """GET /api/applicant/applications/<app_id>/verification-status/"""

    def get(self, request, app_id):
        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        status_data = FaceVerificationService.get_verification_status(application)

        return Response({
            'face_capture': {
                'completed': status_data['face_capture']['completed'],
                'verified': status_data['face_capture']['verified'],
            },
            'liveness_check': {
                'completed': status_data['liveness_check']['completed'],
                'verified': status_data['liveness_check']['verified'],
            }
        })


# =============================================================================
# E-Signature API
# =============================================================================
class ESignatureView(ApplicantBaseView):
    """POST /api/applicant/applications/<app_id>/esignature/"""

    def post(self, request, app_id):
        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        signature = request.data.get('signature')
        terms_accepted = request.data.get('terms_accepted', False)

        if not signature:
            return Response(
                {'error': 'Signature is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not terms_accepted:
            return Response(
                {'error': 'You must accept the terms and conditions'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save signature image (base64)
        filename = f"signature_{uuid.uuid4().hex[:12]}.png"
        file_path = f"applicant/signatures/{application.id}/{filename}"

        full_dir = os.path.join(settings.MEDIA_ROOT, f"applicant/signatures/{application.id}")
        os.makedirs(full_dir, exist_ok=True)

        # If signature is base64, decode and save
        import base64
        if signature.startswith('data:image'):
            signature = signature.split(',')[1]

        signature_bytes = base64.b64decode(signature)
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        with open(full_path, 'wb') as f:
            f.write(signature_bytes)

        # Create or update e-signature
        esig, created = ESignature.objects.update_or_create(
            loan_application=application,
            defaults={
                'signature_image_path': file_path,
                'signed_at': timezone.now(),
                'ip_address': get_client_ip(request),
                'device_info': request.META.get('HTTP_USER_AGENT', ''),
                'terms_accepted': True,
            }
        )

        return Response({
            'id': esig.id,
            'signed_at': esig.signed_at.isoformat(),
            'message': 'Signature saved successfully',
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


# =============================================================================
# Co-Maker API
# =============================================================================
class SearchUsersView(ApplicantBaseView):
    """GET /api/applicant/search-users/?q=<search_term>"""

    def get(self, request):
        query = request.query_params.get('q', '')
        users = CoMakerService.search_registered_users(query, request.user.id)

        return Response({
            'users': [
                {
                    'id': u.id,
                    'email': u.email,
                    'firstname': u.firstname,
                    'lastname': u.lastname,
                    'full_name': f"{u.firstname} {u.lastname}",
                }
                for u in users
            ]
        })


class CoMakerListView(ApplicantBaseView):
    """GET/POST /api/applicant/applications/<app_id>/comakers/"""

    def get(self, request, app_id):
        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        comakers = CoMakerService.get_application_comakers(application)

        return Response({
            'comakers': [
                {
                    'id': cm.id,
                    'user_id': cm.user.id,
                    'user_name': f"{cm.user.firstname} {cm.user.lastname}",
                    'user_email': cm.user.email,
                    'info': {
                        'full_name': cm.detailed_info.full_name if hasattr(cm, 'detailed_info') else '',
                        'relationship': cm.detailed_info.relationship_to_applicant if hasattr(cm, 'detailed_info') else '',
                        'contact_number': cm.detailed_info.contact_number if hasattr(cm, 'detailed_info') else '',
                        'consent_given': cm.detailed_info.consent_given if hasattr(cm, 'detailed_info') else False,
                    } if hasattr(cm, 'detailed_info') else None
                }
                for cm in comakers
            ],
            'required_comakers': application.loan_type.comaker_requirement.required_comakers if hasattr(application.loan_type, 'comaker_requirement') else 0,
        })

    def post(self, request, app_id):
        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        comaker_user_id = request.data.get('comaker_user_id')
        comaker_info = request.data.get('comaker_info', {})

        if not comaker_user_id:
            return Response(
                {'error': 'Co-maker user ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        comaker, error = CoMakerService.add_comaker(
            application,
            comaker_user_id,
            comaker_info,
            request.user
        )

        if error:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'id': comaker.id,
            'user_id': comaker.user.id,
            'user_name': f"{comaker.user.firstname} {comaker.user.lastname}",
            'message': 'Co-maker added successfully',
        }, status=status.HTTP_201_CREATED)


class CoMakerDetailView(ApplicantBaseView):
    """GET/PUT/DELETE /api/applicant/comakers/<id>/"""

    def put(self, request, pk):
        comaker_info_data = request.data

        comaker_info, error = CoMakerService.update_comaker_info(
            pk,
            comaker_info_data,
            request.user
        )

        if error:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'message': 'Co-maker information updated successfully',
        })

    def delete(self, request, pk):
        success, error = CoMakerService.remove_comaker(pk, request.user)

        if not success:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({'message': 'Co-maker removed successfully'})


# =============================================================================
# Calculations API
# =============================================================================
class CalculateAmortizationView(ApplicantBaseView):
    """
    POST /api/applicant/calculate-amortization/
    Body: { loan_type_id, amount, term_months }
    """

    def post(self, request):
        loan_type_id = request.data.get('loan_type_id')
        amount = request.data.get('amount')
        term_months = request.data.get('term_months')

        if not all([loan_type_id, amount, term_months]):
            return Response(
                {'error': 'loan_type_id, amount, and term_months are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            amount = Decimal(str(amount))
            term_months = int(term_months)
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid amount or term'},
                status=status.HTTP_400_BAD_REQUEST
            )

        result = CalculationService.calculate_amortization(
            loan_type_id,
            amount,
            term_months
        )

        if result is None:
            return Response(
                {'error': 'Invalid loan type'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if 'error' in result:
            return Response(
                {'error': result['error']},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(result)


# =============================================================================
# Profile API
# =============================================================================
class ProfileView(ApplicantBaseView):
    """GET/PUT /api/applicant/profile/"""

    def get(self, request):
        user = request.user
        profile = ProfileService.get_or_create_profile(user)
        profile_data = ProfileService.profile_to_dict(profile)

        return Response({
            'user': {
                'id': user.id,
                'email': user.email,
                'firstname': user.firstname,
                'lastname': user.lastname,
            },
            'profile': profile_data,
        })

    def put(self, request):
        profile = ProfileService.update_profile(request.user, request.data)
        profile_data = ProfileService.profile_to_dict(profile)

        return Response({
            'message': 'Profile updated successfully',
            'profile': profile_data,
        })


class ProfilePictureView(ApplicantBaseView):
    """POST/DELETE /api/applicant/profile/picture/"""
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        picture = request.FILES.get('picture')
        if not picture:
            return Response(
                {'error': 'Picture is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        ext = os.path.splitext(picture.name)[1].lower()
        filename = f"profile_{user.id}_{uuid.uuid4().hex[:8]}{ext}"
        file_path = f"profile_pictures/{filename}"

        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, 'wb+') as destination:
            for chunk in picture.chunks():
                destination.write(chunk)

        user.profile_picture = file_path
        user.save()

        return Response({
            'message': 'Profile picture updated successfully',
            'picture_path': file_path,
        })

    def delete(self, request):
        user = request.user
        user.profile_picture = None
        user.save()

        return Response({'message': 'Profile picture removed'})


class ChangePasswordView(ApplicantBaseView):
    """POST /api/applicant/profile/change-password/"""

    def post(self, request):
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not all([current_password, new_password, confirm_password]):
            return Response(
                {'error': 'All password fields are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_password != confirm_password:
            return Response(
                {'error': 'New passwords do not match'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if len(new_password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        if not user.check_password(current_password):
            return Response(
                {'error': 'Current password is incorrect'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()

        return Response({'message': 'Password changed successfully'})


class AutofillDataView(ApplicantBaseView):
    """GET /api/applicant/autofill-data/"""

    def get(self, request):
        data = ProfileService.get_autofill_data(request.user)
        return Response(data)


# =============================================================================
# Notifications API
# =============================================================================
class NotificationListView(ApplicantBaseView):
    """GET /api/applicant/notifications/"""

    def get(self, request):
        limit = request.query_params.get('limit')
        unread_only = request.query_params.get('unread_only', 'false').lower() == 'true'

        limit = int(limit) if limit else None
        notifications = NotificationService.get_notifications(
            request.user,
            limit=limit,
            unread_only=unread_only
        )

        return Response({
            'notifications': [
                {
                    'id': n.id,
                    'title': n.title,
                    'message': n.message,
                    'notification_type': n.notification_type,
                    'is_read': n.is_read,
                    'created_at': n.created_at.isoformat(),
                    'related_application_id': n.related_application_id,
                }
                for n in notifications
            ]
        })


class MarkNotificationReadView(ApplicantBaseView):
    """POST /api/applicant/notifications/<id>/read/"""

    def post(self, request, pk):
        success, error = NotificationService.mark_as_read(pk, request.user)

        if not success:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({'message': 'Notification marked as read'})


class MarkAllNotificationsReadView(ApplicantBaseView):
    """POST /api/applicant/notifications/mark-all-read/"""

    def post(self, request):
        NotificationService.mark_all_as_read(request.user)
        return Response({'message': 'All notifications marked as read'})


class UnreadCountView(ApplicantBaseView):
    """GET /api/applicant/notifications/unread-count/"""

    def get(self, request):
        count = NotificationService.get_unread_count(request.user)
        return Response({'unread_count': count})
