"""
Applicant Module API Views

REST API endpoints for the React Native mobile app.
All endpoints require JWT authentication and Applicant role.
"""

from decimal import Decimal
import mimetypes
import os
import uuid
import logging

from django.conf import settings
from django.core.cache import cache
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.authentication import JWTAuthentication

from .throttles import (
    FaceVerificationThrottle,
    LivenessCheckThrottle,
    DocumentUploadThrottle,
    IDOCRThrottle
)

from shared.services.pdf_service import LoanApplicationPDFService
from loans.models import AuditLog, FaceVerification, LivenessCheck, LoanDocument

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
from .utils import (
    get_client_ip, DocumentTypes, ApplicationStatuses,
    validate_file_type, ALLOWED_DOCUMENT_TYPES, ALLOWED_IMAGE_TYPES,
)

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
                    'user_application_number': app.user_application_number,
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
        # Cache per membership type — loan types change rarely
        member = getattr(request.user, 'applicant', None)
        membership = getattr(member, 'membership_type', 'none')
        cache_key = f'loan_types_{membership}'
        loan_types = cache.get(cache_key)
        if loan_types is None:
            loan_types = LoanApplicationService.get_active_loan_types(user=request.user)
            cache.set(cache_key, loan_types, settings.CACHE_TTL_LOAN_TYPES)
        return Response({'loan_types': loan_types})


class LoanTypeDetailView(ApplicantBaseView):
    """GET /api/applicant/loan-types/<id>/"""

    def get(self, request, pk):
        cache_key = f'loan_type_detail_{pk}'
        loan_type = cache.get(cache_key)
        if loan_type is None:
            loan_type = LoanApplicationService.get_loan_type_detail(pk)
            if not loan_type:
                return Response(
                    {'error': 'Loan type not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            cache.set(cache_key, loan_type, settings.CACHE_TTL_LOAN_TYPES)
        return Response(loan_type)


class LoanTypeRequiredDocumentsView(ApplicantBaseView):
    """
    GET /api/applicant/loan-types/<id>/required-documents/
    Returns the document checklist for the given loan type.
    Falls back to the universal required set if no rows are configured.
    """

    def get(self, request, pk):
        from loans.models import LoanType, LoanTypeRequiredDocument
        from .utils import DocumentTypes

        # Required documents almost never change — cache for 10 minutes
        cache_key = f'required_docs_{pk}'
        cached_response = cache.get(cache_key)
        if cached_response is not None:
            return Response(cached_response)

        try:
            loan_type = LoanType.objects.get(pk=pk, is_active=True)
        except LoanType.DoesNotExist:
            return Response({'error': 'Loan type not found'}, status=status.HTTP_404_NOT_FOUND)

        qs = LoanTypeRequiredDocument.objects.filter(loan_type=loan_type).order_by('sort_order', 'document_label')

        if qs.exists():
            documents = [
                {
                    'key': doc.document_key,
                    'label': doc.document_label,
                    'description': doc.description or '',
                    'required': doc.is_required,
                    'multiple': doc.document_key == 'other_documents',
                    'accepted_types': ['image'] if doc.document_key == 'buksu_id' else ['image', 'pdf'],
                }
                for doc in qs
            ]
        else:
            # Fallback: universal minimum set
            documents = [
                {
                    'key': k,
                    'label': DocumentTypes.DISPLAY_NAMES.get(k, k),
                    'description': '',
                    'required': True,
                    'multiple': False,
                    'accepted_types': ['image', 'pdf'],
                }
                for k in DocumentTypes.REQUIRED_DOCUMENTS
            ] + [
                {
                    'key': 'other_documents',
                    'label': 'Other Supporting Documents',
                    'description': 'Any additional supporting documents',
                    'required': False,
                    'multiple': True,
                    'accepted_types': ['image', 'pdf'],
                }
            ]

        response_data = {'loan_type_id': pk, 'documents': documents}
        cache.set(cache_key, response_data, settings.CACHE_TTL_REQUIRED_DOCS)
        return Response(response_data)


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
                    'user_application_number': app.user_application_number,
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
                    'released_at': app.released_at.date().isoformat() if app.released_at else None,
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
            'user_application_number': application.user_application_number,
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

        # Get rejection info if applicable
        current_status_name = application.current_status.status_name if application.current_status else ''
        rejection_info = None
        if current_status_name == ApplicationStatuses.REJECTED_BOOKKEEPER:
            bv = application.bookkeeper_verifications.filter(action='rejected').order_by('-verified_at').first()
            if bv:
                rejection_info = {
                    'reason': bv.rejection_reason,
                    'category': bv.rejection_category,
                    'rejected_at': bv.verified_at.isoformat(),
                    'role': 'Bookkeeper',
                }
        elif current_status_name == ApplicationStatuses.REJECTED_CREDIT:
            cc = application.credit_committee_decisions.filter(decision='rejected').order_by('-decided_at').first()
            if cc:
                rejection_info = {
                    'reason': cc.remarks,
                    'category': cc.rejection_category,
                    'rejected_at': cc.decided_at.isoformat(),
                    'role': 'Credit Committee',
                }

        return Response({
            'id': application.id,
            'user_application_number': application.user_application_number,
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
            'rejection_info': rejection_info,
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


class ReopenApplicationView(ApplicantBaseView):
    """POST /api/applicant/applications/<id>/reopen/"""

    def post(self, request, pk):
        application = LoanApplicationService.get_application_by_id(pk, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        success, error = LoanApplicationService.reopen_application(application, request.user)

        if not success:
            return Response(
                {'error': error},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'message': 'Application reopened for editing. You may now edit and resubmit.',
            'status': 'Draft',
            'application_id': application.id,
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
    throttle_classes = [DocumentUploadThrottle]

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

        # Validate actual file type via magic bytes before touching disk
        is_valid, mime_error = validate_file_type(file, ALLOWED_DOCUMENT_TYPES)
        if not is_valid:
            return Response({'error': mime_error}, status=status.HTTP_400_BAD_REQUEST)

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

        # Encrypt file at rest — block upload if encryption fails to avoid storing plaintext PII
        from .encryption_utils import FileEncryptionService
        encrypt_success, encrypt_error = FileEncryptionService.encrypt_file(full_path)
        if not encrypt_success:
            os.remove(full_path)
            logger.error(f"Failed to encrypt document {file_path}: {encrypt_error}")
            return Response(
                {'error': 'Failed to secure file. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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

    def get(self, request, pk):
        try:
            document = LoanDocument.objects.select_related('loan_application').get(pk=pk)
        except LoanDocument.DoesNotExist:
            return Response(
                {'error': 'Document not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if document.loan_application.user != request.user:
            return Response(
                {'error': "You don't have permission to view this document."},
                status=status.HTTP_403_FORBIDDEN
            )

        if not document.file_path:
            return Response(
                {'error': 'Document file is missing'},
                status=status.HTTP_404_NOT_FOUND
            )

        full_path = os.path.join(settings.MEDIA_ROOT, document.file_path)
        if not os.path.exists(full_path):
            return Response(
                {'error': 'Document file not found on server'},
                status=status.HTTP_404_NOT_FOUND
            )

        from .encryption_utils import FileEncryptionService
        success, decrypted_data, _ = FileEncryptionService.decrypt_file(full_path)
        if success:
            file_bytes = decrypted_data
        else:
            with open(full_path, 'rb') as f:
                file_bytes = f.read()

        content_type, _ = mimetypes.guess_type(document.file_path)
        response = HttpResponse(file_bytes, content_type=content_type or 'application/octet-stream')
        response['Content-Disposition'] = f'inline; filename="{os.path.basename(document.file_path)}"'
        return response

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

        # Validate actual file type via magic bytes before touching disk
        is_valid, mime_error = validate_file_type(file, ALLOWED_DOCUMENT_TYPES)
        if not is_valid:
            return Response({'error': mime_error}, status=status.HTTP_400_BAD_REQUEST)

        # Save new file
        ext = os.path.splitext(file.name)[1].lower()
        filename = f"replaced_{uuid.uuid4().hex[:12]}{ext}"
        file_path = f"applicant/documents/{filename}"

        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)

        # Encrypt replacement file at rest — block if encryption fails
        from .encryption_utils import FileEncryptionService
        encrypt_success, encrypt_error = FileEncryptionService.encrypt_file(full_path)
        if not encrypt_success:
            os.remove(full_path)
            logger.error(f"Failed to encrypt replacement document {file_path}: {encrypt_error}")
            return Response(
                {'error': 'Failed to secure file. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
    throttle_classes = [IDOCRThrottle]

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

        # Validate actual file type via magic bytes (not extension — client-provided names are untrusted)
        is_valid, mime_error = validate_file_type(image, ALLOWED_IMAGE_TYPES)
        if not is_valid:
            return Response({'error': mime_error}, status=status.HTTP_400_BAD_REQUEST)

        ext = os.path.splitext(image.name)[1].lower() or '.jpg'

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
        from .encryption_utils import FileEncryptionService
        try:
            result = IDOCRService.process_id_image(full_path, profile_name)
        except Exception as e:
            import traceback
            logger.exception(f"OCR processing error: {str(e)}")
            os.remove(full_path)
            return Response({
                'success': False,
                'error': f'OCR processing failed: {str(e)}',
                'message': 'Could not process ID. Please ensure the image is clear and try again.',
                'debug_info': traceback.format_exc() if settings.DEBUG else None,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        finally:
            # Always encrypt ID image — even on OCR failure, the file must not remain plaintext
            if os.path.exists(full_path):
                encrypt_success, encrypt_error = FileEncryptionService.encrypt_file(full_path)
                if not encrypt_success:
                    logger.error(f"Failed to encrypt ID scan {file_path}: {encrypt_error}")

        # Add image path to response
        result['image_path'] = file_path

        if result.get('success'):
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response(result, status=status.HTTP_422_UNPROCESSABLE_ENTITY)


# =============================================================================
# Face Verification API
# =============================================================================
class FaceCaptureView(ApplicantBaseView):
    """POST /api/applicant/applications/<app_id>/face-capture/"""
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [FaceVerificationThrottle]

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

        # Validate actual file type via magic bytes (not extension — client-provided names are untrusted)
        is_valid, mime_error = validate_file_type(image, ALLOWED_IMAGE_TYPES)
        if not is_valid:
            return Response({'error': mime_error}, status=status.HTTP_400_BAD_REQUEST)

        # Save image
        ext = os.path.splitext(image.name)[1].lower() or '.jpg'
        filename = f"face_{uuid.uuid4().hex[:12]}{ext}"
        file_path = f"applicant/faces/{application.id}/{filename}"

        full_dir = os.path.join(settings.MEDIA_ROOT, f"applicant/faces/{application.id}")
        os.makedirs(full_dir, exist_ok=True)

        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        with open(full_path, 'wb+') as destination:
            for chunk in image.chunks():
                destination.write(chunk)

        # Debug logging
        import logging
        logger = logging.getLogger('face_verification')
        logger.info(f"[FaceCaptureView] Saved face image:")
        logger.info(f"  - file_path (relative): {file_path}")
        logger.info(f"  - full_path: {full_path}")
        logger.info(f"  - File exists: {os.path.exists(full_path)}")
        if os.path.exists(full_path):
            logger.info(f"  - File size: {os.path.getsize(full_path)} bytes")

        # Save face capture (creates or updates FaceVerification record)
        verification = FaceVerificationService.save_face_capture(
            application,
            file_path,
            request.user,
            match_score=None  # Will be set by face comparison service
        )

        # Perform face comparison using DeepFace
        # Lazy import — keeps TensorFlow out of Django's startup path so login/dashboard load instantly
        from .encryption_utils import FileEncryptionService
        comparison_error = None
        try:
            from .face_verification_service import FaceComparisonService
            verification = FaceComparisonService.verify_faces_for_application(application.id, captured_image_path=file_path)
        except Exception as e:
            comparison_error = e
        finally:
            # Always encrypt face image regardless of comparison outcome —
            # face photos are sensitive biometric data and must never rest plaintext.
            if os.path.exists(full_path):
                encrypt_success, encrypt_error = FileEncryptionService.encrypt_file(full_path)
                if not encrypt_success:
                    logger.error(f"Failed to encrypt face image {file_path}: {encrypt_error}")

        if comparison_error:
            return Response({
                'error': f'Face verification error: {str(comparison_error)}',
                'message': 'An error occurred during face verification. Please try again.',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if verification:
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
            elif verification.verification_status == 'Needs Review':
                response_data['message'] = (
                    f'Face verification requires manual review. '
                    f'Similarity score: {verification.similarity_score}%. '
                    f'A bookkeeper will review your application.'
                )
                return Response(response_data, status=status.HTTP_200_OK)
            else:
                response_data['message'] = verification.error_message or 'Face verification failed'
                return Response(response_data, status=status.HTTP_422_UNPROCESSABLE_ENTITY)


class RetryFaceVerificationView(ApplicantBaseView):
    """POST /api/applicant/applications/<app_id>/face-verification/retry/"""
    throttle_classes = [FaceVerificationThrottle]

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

        # Get existing captured image path before retry
        existing_verification = FaceVerification.objects.filter(
            loan_application=application
        ).order_by('-created_at').first()

        captured_image_path = existing_verification.captured_image_path if existing_verification else None

        if not captured_image_path:
            return Response(
                {'error': 'No previous face capture found. Please upload a new selfie.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Perform face comparison (lazy import — TensorFlow loads on first use, not at startup)
        try:
            from .face_verification_service import FaceComparisonService
            verification = FaceComparisonService.verify_faces_for_application(application.id, captured_image_path=captured_image_path)

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
    """
    POST /api/applicant/applications/<app_id>/liveness-check/

    Performs liveness detection using MediaPipe to verify the user is a real person.
    Supports multiple detection methods:
    - 'blink': Eye blink detection using Eye Aspect Ratio (EAR)
    - 'head_turn': Head pose detection
    - 'combined': Both blink and head pose checks (recommended)

    The liveness check must pass before application can be submitted.
    """
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [LivenessCheckThrottle]

    def post(self, request, app_id):
        from .liveness_service import LivenessVerificationService

        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        method = request.data.get('method', 'combined')
        image = request.FILES.get('image')

        if not image:
            return Response(
                {'error': 'Image is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate method
        valid_methods = ['blink', 'head_turn', 'head_nod', 'combined']
        if method not in valid_methods:
            return Response(
                {'error': f'Invalid method. Must be one of: {", ".join(valid_methods)}'},
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
        filename = f"liveness_{uuid.uuid4().hex[:12]}{ext}"
        file_path = f"applicant/liveness/{application.id}/{filename}"

        full_dir = os.path.join(settings.MEDIA_ROOT, f"applicant/liveness/{application.id}")
        os.makedirs(full_dir, exist_ok=True)

        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        with open(full_path, 'wb+') as destination:
            for chunk in image.chunks():
                destination.write(chunk)

        # Perform liveness verification using MediaPipe
        try:
            result = LivenessVerificationService.verify_liveness_for_application(
                application_id=application.id,
                image_path=full_path,
                method=method
            )

            # Build response based on result
            response_data = {
                'id': result.get('liveness_check_id'),
                'method': method,
                'status': result.get('check_status', 'Failed'),
                'is_live': result.get('is_live', False),
                'confidence': result.get('confidence', 0.0),
                'threshold': result.get('threshold', 70.0),
                'details': result.get('details', {}),
            }

            if result.get('is_live') and result.get('check_status') == 'Verified':
                response_data['message'] = f"Liveness check passed! Confidence: {result.get('confidence', 0):.1f}%"
                return Response(response_data, status=status.HTTP_201_CREATED)
            else:
                response_data['message'] = result.get('error_message', 'Liveness check failed. Please try again.')
                response_data['error'] = result.get('error_message', 'Liveness verification failed')
                # Return 422 to indicate the check failed but request was valid
                return Response(response_data, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        except Exception as e:
            logger.exception(f"Liveness check error: {str(e)}")
            return Response({
                'error': f'Liveness check error: {str(e)}',
                'message': 'An error occurred during liveness verification. Please try again.',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LivenessVideoView(ApplicantBaseView):
    """
    POST /api/applicant/applications/<app_id>/liveness-video/

    Performs liveness detection from a video file.
    Extracts multiple frames from the video and analyzes them for liveness indicators.
    This provides more robust anti-spoofing compared to single-image liveness checks.

    Request:
        - video: Video file (MP4, MOV, AVI)

    Response:
        - Liveness verification results
    """
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [LivenessCheckThrottle]

    def post(self, request, app_id):
        from .liveness_service import LivenessVerificationService
        import cv2
        import tempfile

        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        video = request.FILES.get('video')
        if not video:
            return Response(
                {'error': 'Video file is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type
        allowed_extensions = ['.mp4', '.mov', '.avi', '.webm']
        ext = os.path.splitext(video.name)[1].lower()
        if ext not in allowed_extensions:
            return Response(
                {'error': f'Invalid file type. Allowed: {", ".join(allowed_extensions)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save video to disk
        filename = f"liveness_video_{uuid.uuid4().hex[:12]}{ext}"
        file_path = f"applicant/liveness/{application.id}/{filename}"

        full_dir = os.path.join(settings.MEDIA_ROOT, f"applicant/liveness/{application.id}")
        os.makedirs(full_dir, exist_ok=True)

        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        with open(full_path, 'wb+') as destination:
            for chunk in video.chunks():
                destination.write(chunk)

        try:
            import logging as _logging
            _lv_logger = _logging.getLogger('liveness_detection')

            # Extract frames from video for analysis
            cap = cv2.VideoCapture(full_path)

            if not cap.isOpened():
                return Response({
                    'error': 'Failed to read video file',
                    'message': 'Could not process the uploaded video. Please try again.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Get video properties
            fps = cap.get(cv2.CAP_PROP_FPS)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

            # Detect video rotation metadata (mobile phones encode portrait video with a rotation tag)
            rotation = int(cap.get(cv2.CAP_PROP_ORIENTATION_META) or 0)
            _lv_logger.info(f"[LivenessVideo] Video: {total_frames} frames @ {fps}fps, {width}x{height}, rotation={rotation}")

            # Extract frames at regular intervals (analyze 5-8 frames throughout the video)
            num_frames_to_analyze = min(8, max(5, total_frames // 10))
            frame_indices = [int(i * total_frames / num_frames_to_analyze) for i in range(num_frames_to_analyze)]

            frames_analyzed = 0
            liveness_results = []
            temp_frame_files = []

            for frame_idx in frame_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()

                if not ret:
                    _lv_logger.warning(f"[LivenessVideo] Could not read frame at index {frame_idx}")
                    continue

                # Correct for mobile video rotation so MediaPipe sees an upright face
                if rotation == 90:
                    frame = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
                elif rotation == 180:
                    frame = cv2.rotate(frame, cv2.ROTATE_180)
                elif rotation == 270:
                    frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)

                # Save frame temporarily — close before imwrite (NamedTemporaryFile stays open
                # on Windows which prevents cv2.imwrite from writing to the same path)
                temp_frame = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg', dir=full_dir)
                temp_frame_path = temp_frame.name
                temp_frame.close()
                write_ok = cv2.imwrite(temp_frame_path, frame)
                _lv_logger.info(f"[LivenessVideo] Frame {frame_idx}: saved to {temp_frame_path}, write_ok={write_ok}, shape={frame.shape}")
                temp_frame_files.append(temp_frame_path)

                # Analyze this frame for liveness
                result = LivenessVerificationService.verify_liveness_for_application(
                    application_id=application.id,
                    image_path=temp_frame_path,
                    method='combined'
                )

                _lv_logger.info(
                    f"[LivenessVideo] Frame {frame_idx}: is_live={result.get('is_live')}, "
                    f"confidence={result.get('confidence'):.1f}%, "
                    f"error={result.get('error_message')}, "
                    f"details={result.get('details', {}).get('checks_summary')}"
                )

                liveness_results.append(result)
                frames_analyzed += 1

            cap.release()

            # Clean up temporary frame files
            for temp_file in temp_frame_files:
                try:
                    os.remove(temp_file)
                except:
                    pass

            if frames_analyzed == 0:
                return Response({
                    'error': 'No frames could be extracted from video',
                    'message': 'Failed to process video. Please try recording again.'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Aggregate results - require majority of frames to pass
            # A frame passes if is_live or confidence is reasonably high (handles border cases)
            passed_frames = sum(
                1 for r in liveness_results
                if r.get('is_live', False) or r.get('confidence', 0) >= 60
            )
            avg_confidence = sum(r.get('confidence', 0) for r in liveness_results) / len(liveness_results)

            _lv_logger.info(f"[LivenessVideo] Summary: {passed_frames}/{frames_analyzed} frames passed, avg_confidence={avg_confidence:.1f}%")

            overall_passed = passed_frames >= (frames_analyzed * 0.6)  # 60% must pass

            # Persist liveness result so submit_application validation can find it
            lc_status = 'Verified' if overall_passed else 'Failed'
            LivenessCheck.objects.filter(loan_application=application).delete()
            LivenessCheck.objects.create(
                loan_application=application,
                method='video',
                confidence_score=round(avg_confidence, 2),
                check_status=lc_status,
                verified_at=timezone.now() if overall_passed else None,
            )

            # Encrypt video file after processing
            from .encryption_utils import FileEncryptionService
            encrypt_success, encrypt_error = FileEncryptionService.encrypt_file(full_path)
            if not encrypt_success:
                import logging
                logger = logging.getLogger('encryption')
                logger.error(f"Failed to encrypt liveness video {file_path}: {encrypt_error}")

            response_data = {
                'method': 'video',
                'frames_analyzed': frames_analyzed,
                'frames_passed': passed_frames,
                'pass_rate': f"{(passed_frames / frames_analyzed * 100):.1f}%",
                'average_confidence': round(avg_confidence, 2),
                'is_live': overall_passed,
                'status': 'Verified' if overall_passed else 'Failed',
            }

            if overall_passed:
                response_data['message'] = f"Video liveness check passed! Analyzed {frames_analyzed} frames with {avg_confidence:.1f}% average confidence."
                return Response(response_data, status=status.HTTP_201_CREATED)
            else:
                response_data['message'] = f"Liveness check failed. Only {passed_frames}/{frames_analyzed} frames passed. Please try again with better lighting and follow the instructions."
                response_data['error'] = 'Liveness verification failed'
                return Response(response_data, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        except Exception as e:
            logger.exception(f"Video liveness check error: {str(e)}")
            return Response({
                'error': f'Video processing error: {str(e)}',
                'message': 'An error occurred while processing the video. Please try again.',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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

        # Get latest verification details
        face_details = {}
        if status_data['face_capture']['latest']:
            fv = status_data['face_capture']['latest']
            face_details = {
                'similarity_score': float(fv.similarity_score) if fv.similarity_score else None,
                'is_match': fv.is_match,
                'error_message': fv.error_message,
            }

        liveness_details = {}
        if status_data['liveness_check']['latest']:
            lc = status_data['liveness_check']['latest']
            liveness_details = {
                'confidence_score': float(lc.confidence_score) if lc.confidence_score else None,
                'method': lc.method,
            }

        return Response({
            'face_capture': {
                'completed': status_data['face_capture']['completed'],
                'verified': status_data['face_capture']['verified'],
                'details': face_details,
            },
            'liveness_check': {
                'completed': status_data['liveness_check']['completed'],
                'verified': status_data['liveness_check']['verified'],
                'details': liveness_details,
            },
            'can_submit': (
                status_data['face_capture']['verified'] and
                status_data['liveness_check']['verified']
            )
        })


class CombinedVerificationView(ApplicantBaseView):
    """
    POST /api/applicant/applications/<app_id>/combined-verification/

    Performs both liveness detection AND face comparison in a single request.
    This is the recommended endpoint for mobile apps.

    Request:
        - selfie: File (required) - Selfie image for liveness and face comparison

    Response:
        - liveness: Liveness check result
        - face_comparison: Face comparison result (ID photo vs selfie)
        - overall_verified: Boolean - True if both checks passed
    """
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [FaceVerificationThrottle, LivenessCheckThrottle]

    def post(self, request, app_id):
        from .liveness_service import LivenessVerificationService

        application = LoanApplicationService.get_application_by_id(app_id, request.user)
        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        selfie = request.FILES.get('selfie') or request.FILES.get('image')
        method = request.data.get('method', 'combined')

        if not selfie:
            return Response(
                {'error': 'Selfie image is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file type
        allowed_extensions = ['.jpg', '.jpeg', '.png', '.webp']
        ext = os.path.splitext(selfie.name)[1].lower()
        if ext not in allowed_extensions:
            return Response(
                {'error': f'Invalid file type. Allowed: {", ".join(allowed_extensions)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Save selfie to disk
        filename = f"selfie_{uuid.uuid4().hex[:12]}{ext}"
        file_path = f"applicant/faces/{application.id}/{filename}"

        full_dir = os.path.join(settings.MEDIA_ROOT, f"applicant/faces/{application.id}")
        os.makedirs(full_dir, exist_ok=True)

        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        with open(full_path, 'wb+') as destination:
            for chunk in selfie.chunks():
                destination.write(chunk)

        try:
            # Perform combined verification (liveness + face comparison)
            result = LivenessVerificationService.verify_with_face_comparison(
                application_id=application.id,
                selfie_path=full_path,
                method=method
            )

            # Build response
            response_data = {
                'overall_verified': result.get('overall_verified', False),
                'liveness': result.get('liveness', {}),
                'face_comparison': result.get('face_comparison', {}),
                'can_submit': result.get('overall_verified', False),
            }

            if result.get('overall_verified'):
                response_data['message'] = 'Verification successful! Both liveness and face comparison passed.'
                return Response(response_data, status=status.HTTP_201_CREATED)
            else:
                response_data['message'] = result.get('error_message', 'Verification failed')
                response_data['error'] = result.get('error_message', 'Verification failed')
                return Response(response_data, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

        except Exception as e:
            logger.exception(f"Combined verification error: {str(e)}")
            return Response({
                'error': f'Verification error: {str(e)}',
                'message': 'An error occurred during verification. Please try again.',
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# =============================================================================
# Co-Maker API
# =============================================================================
class SearchUsersView(ApplicantBaseView):
    """GET /api/applicant/search-users/?q=<search_term>&limit=20&offset=0&loan_amount=<amount>"""

    def get(self, request):
        query = request.query_params.get('q', '')
        limit = request.query_params.get('limit', 20)
        offset = request.query_params.get('offset', 0)
        loan_amount = request.query_params.get('loan_amount', None)

        try:
            limit = int(limit)
            offset = int(offset)
        except (ValueError, TypeError):
            limit = 20
            offset = 0

        try:
            loan_amount = float(loan_amount) if loan_amount else None
        except (ValueError, TypeError):
            loan_amount = None

        result = CoMakerService.search_registered_users(
            query, request.user.id, limit=limit, offset=offset, loan_amount=loan_amount
        )

        return Response({
            'users': [
                {
                    'id': u.id,
                    'email': u.email,
                    'firstname': u.firstname,
                    'lastname': u.lastname,
                    'full_name': f"{u.firstname} {u.lastname}",
                    'membership_type': getattr(u, 'membership_type', ''),
                    'verified_employment_status': getattr(u, 'verified_employment_status', '') or '',
                    'position': getattr(u, 'position', '') or '',
                    'rank_label': result['required_rank_label'],
                }
                for u in result['users']
            ],
            'total': result['total'],
            'has_more': result['has_more'],
            'offset': offset,
            'limit': limit,
            'required_rank_label': result['required_rank_label'],
            'allowed_statuses': result['allowed_statuses'],
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
                    'status': cm.status,
                    'responded_at': cm.responded_at,
                    'rank_position': getattr(cm, '_rank_position', None),
                    'is_repeat': getattr(cm, '_is_repeat', False),
                    'verified_employment_status': getattr(cm, '_emp_status', ''),
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
            'is_repeat': getattr(comaker, '_is_repeat', False),
            'auto_id_pulled': getattr(comaker, '_auto_id_pulled', False),
            'rank_label': getattr(comaker, '_rank_label', ''),
            'verified_employment_status': getattr(comaker, '_comaker_emp_status', ''),
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


class CoMakerRequestListView(ApplicantBaseView):
    """GET /api/applicant/comaker-requests/ — list requests where I am the co-maker."""

    def get(self, request):
        requests_qs = CoMakerService.get_comaker_requests(request.user)
        data = []
        for cm in requests_qs:
            app = cm.application
            data.append({
                'id': cm.id,
                'status': cm.status,
                'agreed_at': cm.agreed_at,
                'responded_at': cm.responded_at,
                'applicant_name': f"{app.user.firstname} {app.user.lastname}",
                'applicant_email': app.user.email,
                'application': {
                    'id': app.id,
                    'loan_type': app.loan_type.loan_name,
                    'amount_requested': app.amount_requested,
                    'term_months': app.term_months,
                    'monthly_amortization': app.monthly_amortization,
                    'total_payable': app.total_payable,
                    'purpose': app.purpose,
                    'application_date': app.application_date,
                    'current_status': app.current_status.status_name if app.current_status else None,
                },
            })
        return Response({'comaker_requests': data})


class CoMakerRequestRespondView(ApplicantBaseView):
    """POST /api/applicant/comaker-requests/<id>/respond/ — accept or reject."""

    def post(self, request, pk):
        action = request.data.get('action')
        if action not in ('accept', 'reject'):
            return Response(
                {'error': "action must be 'accept' or 'reject'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        loan_comaker, error = CoMakerService.respond_to_comaker_request(pk, request.user, action)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': f"You have {loan_comaker.status} the co-maker request.",
            'status': loan_comaker.status,
        })


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

        # Membership info (set by AMO after approval)
        member = getattr(user, 'applicant', None)
        membership_data = {
            'membership_type': member.membership_type if member else None,
            'membership_status': member.membership_status if member else None,
            'subscribed_shares': member.subscribed_shares if member else None,
            'paid_shares': member.paid_shares if member else None,
            'member_since': member.member_since.isoformat() if (member and member.member_since) else None,
            'total_savings': str(member.total_savings) if member else '0.00',
            'total_shared_capital': str(member.total_shared_capital) if member else '0.00',
            'fixed_deposit': str(member.fixed_deposit) if (member and getattr(member, 'fixed_deposit', None) is not None) else None,
            'verified_employment_status': getattr(member, 'verified_employment_status', None) if member else None,
        }

        return Response({
            'user': {
                'id': user.id,
                'email': user.email,
                'firstname': user.firstname,
                'lastname': user.lastname,
            },
            'profile': profile_data,
            'membership': membership_data,
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
            'profile_picture': request.build_absolute_uri(user.profile_picture.url),
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


class ProfileUpdateRequiredView(ApplicantBaseView):
    """GET /api/applicant/profile/update-required/"""

    def get(self, request):
        from django.utils import timezone
        user = request.user
        profile_updated_at = getattr(user, 'profile_updated_at', None)
        if not profile_updated_at:
            return Response({'update_required': False, 'months_since_update': 0})
        months_since = (timezone.now() - profile_updated_at).days // 30
        return Response({
            'update_required': months_since >= 6,
            'last_updated': profile_updated_at.date().isoformat(),
            'months_since_update': months_since,
        })


# =============================================================================
# Employment Status Change Request API
# =============================================================================

class EmploymentStatusChangeRequestView(ApplicantBaseView):
    """POST /api/applicant/employment-status-change/"""
    parser_classes = [MultiPartParser, FormParser]

    VALID_STATUSES = ['regular', 'casual', 'job_order', 'part_time']

    def post(self, request):
        from users.models import EmploymentStatusChangeRequest
        from datetime import timedelta

        applicant = request.user
        requested_status = request.data.get('requested_status', '').strip()
        coe_document = request.FILES.get('coe_document')

        if not requested_status or requested_status not in self.VALID_STATUSES:
            return Response(
                {'error': f"Invalid status. Choose from: {', '.join(self.VALID_STATUSES)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not coe_document:
            return Response(
                {'error': 'Certificate of Employment (COE) document is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if requested_status == applicant.employment_status:
            return Response(
                {'error': 'The requested status is the same as your current status.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check for existing pending request
        if EmploymentStatusChangeRequest.objects.filter(
            applicant=applicant, status='pending'
        ).exists():
            return Response(
                {'error': 'You already have a pending employment status change request.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Enforce 6-month cooldown based on most recent request (any status)
        last_request = (
            EmploymentStatusChangeRequest.objects
            .filter(applicant=applicant)
            .order_by('-requested_at')
            .first()
        )
        if last_request:
            six_months_ago = timezone.now() - timedelta(days=183)
            if last_request.requested_at > six_months_ago:
                next_allowed = last_request.requested_at + timedelta(days=183)
                return Response(
                    {
                        'error': (
                            'You can only update your employment status once every 6 months. '
                            f'Next update available on: {next_allowed.date().isoformat()}.'
                        ),
                        'next_allowed_date': next_allowed.date().isoformat(),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        req = EmploymentStatusChangeRequest.objects.create(
            applicant=applicant,
            current_status=applicant.employment_status,
            requested_status=requested_status,
            coe_document=coe_document,
        )
        return Response(
            {
                'id': req.id,
                'status': req.status,
                'current_status': req.current_status,
                'requested_status': req.requested_status,
                'requested_at': req.requested_at.isoformat(),
                'message': 'Employment status change request submitted. Awaiting AMO review.',
            },
            status=status.HTTP_201_CREATED,
        )


class EmploymentStatusChangeLatestView(ApplicantBaseView):
    """GET /api/applicant/employment-status-change/latest/"""

    def get(self, request):
        from users.models import EmploymentStatusChangeRequest
        from datetime import timedelta

        applicant = request.user
        last_request = (
            EmploymentStatusChangeRequest.objects
            .filter(applicant=applicant)
            .order_by('-requested_at')
            .first()
        )

        six_months_ago = timezone.now() - timedelta(days=183)

        if not last_request:
            return Response({'has_request': False, 'can_request': True})

        next_allowed = last_request.requested_at + timedelta(days=183)
        can_request = (
            last_request.status != 'pending'
            and last_request.requested_at <= six_months_ago
        )

        return Response({
            'has_request': True,
            'id': last_request.id,
            'status': last_request.status,
            'current_status': last_request.current_status,
            'requested_status': last_request.requested_status,
            'requested_at': last_request.requested_at.isoformat(),
            'reviewed_at': last_request.reviewed_at.isoformat() if last_request.reviewed_at else None,
            'rejection_reason': last_request.rejection_reason,
            'next_allowed_date': next_allowed.date().isoformat(),
            'can_request': can_request,
        })


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

        cache.delete(f'notif_unread_{request.user.id}')
        return Response({'message': 'Notification marked as read'})


class MarkAllNotificationsReadView(ApplicantBaseView):
    """POST /api/applicant/notifications/mark-all-read/"""

    def post(self, request):
        NotificationService.mark_all_as_read(request.user)
        cache.delete(f'notif_unread_{request.user.id}')
        return Response({'message': 'All notifications marked as read'})


class UnreadCountView(ApplicantBaseView):
    """GET /api/applicant/notifications/unread-count/"""

    def get(self, request):
        cache_key = f'notif_unread_{request.user.id}'
        count = cache.get(cache_key)
        if count is None:
            count = NotificationService.get_unread_count(request.user)
            cache.set(cache_key, count, settings.CACHE_TTL_NOTIFICATIONS)
        return Response({'unread_count': count})


class DeleteNotificationView(ApplicantBaseView):
    """POST /api/applicant/notifications/<id>/delete/"""

    def post(self, request, pk):
        success, error = NotificationService.delete_notification(pk, request.user)
        if not success:
            return Response({'error': error}, status=status.HTTP_404_NOT_FOUND)
        cache.delete(f'notif_unread_{request.user.id}')
        return Response({'message': 'Notification deleted'})


class ArchiveNotificationView(ApplicantBaseView):
    """POST /api/applicant/notifications/<id>/archive/"""

    def post(self, request, pk):
        success, error = NotificationService.archive_notification(pk, request.user)
        if not success:
            return Response({'error': error}, status=status.HTTP_404_NOT_FOUND)
        return Response({'message': 'Notification archived'})


# =============================================================================
# Loan Payment Schedule (Applicant view of their active loan)
# =============================================================================

class LoanScheduleView(ApplicantBaseView):
    """
    GET /api/applicant/applications/<id>/schedule/
    Returns the payment schedule and balance summary for an active loan.
    Scoped to the requesting applicant's own loans only.
    """

    def get(self, request, pk):
        from loans.models import LoanApplication, PaymentSchedule
        from datetime import date

        try:
            loan = LoanApplication.objects.select_related(
                'current_status', 'loan_type'
            ).get(pk=pk, user=request.user)
        except LoanApplication.DoesNotExist:
            return Response({'error': 'Loan not found.'}, status=status.HTTP_404_NOT_FOUND)

        viewable_statuses = ['Active', 'Overdue', 'Completed', 'Disbursed', 'Closed']
        current = loan.current_status.status_name if loan.current_status else ''
        if current not in viewable_statuses:
            return Response(
                {'error': 'Payment schedule is not available for this loan status.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        schedule = PaymentSchedule.objects.filter(application=loan).order_by('installment_number')

        today = date.today()
        next_installment = schedule.filter(
            status__in=['pending', 'partial', 'late', 'overdue']
        ).order_by('due_date').first()

        return Response({
            'loan_summary': {
                'loan_id': loan.id,
                'loan_type': loan.loan_type.loan_name,
                'amount_requested': str(loan.amount_requested),
                'total_payable': str(loan.total_payable) if loan.total_payable else '0.00',
                'total_paid': str(loan.total_paid),
                'remaining_balance': str(loan.remaining_balance),
                'monthly_amortization': str(loan.monthly_amortization) if loan.monthly_amortization else '0.00',
                'installment_type': loan.installment_type,
                'status': current,
                'loan_health_status': loan.loan_health_status,
                'activated_at': str(loan.activated_at) if loan.activated_at else None,
                'released_at': loan.released_at.isoformat() if loan.released_at else None,
                'next_due_date': str(next_installment.due_date) if next_installment else None,
                'next_amount_due': str(next_installment.amount_due - next_installment.amount_paid) if next_installment else None,
            },
            'schedule': [
                {
                    'installment_number': s.installment_number,
                    'due_date': str(s.due_date),
                    'amount_due': str(s.amount_due),
                    'amount_paid': str(s.amount_paid),
                    'balance_due': str(s.balance_due),
                    'status': s.status,
                    'paid_at': s.paid_at.isoformat() if s.paid_at else None,
                    'is_overdue': s.due_date < today and s.status not in ('paid',),
                }
                for s in schedule
            ],
        })
