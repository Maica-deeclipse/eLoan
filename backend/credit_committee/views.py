"""
Credit Committee Module API Views

REST API endpoints for the React frontend.
All endpoints require JWT authentication and Credit Committee role.
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import OutstandingToken, BlacklistedToken
from django.shortcuts import get_object_or_404
from django.contrib.auth.hashers import check_password
from django.utils import timezone
from datetime import datetime

from .services import (
    CreditCommitteeApplicationService,
    DecisionService,
    CreditCommitteeDashboardService,
    CreditCommitteeReportService,
    CreditCommitteeNotificationService
)
from loans.models import LoanApplication, LoanType, StatusChangeLog
from users.models import UserPreferences


def _days_in_stage(application, status_name):
    """Return the number of days this application has been in the given stage."""
    log = StatusChangeLog.objects.filter(
        application=application,
        to_status__status_name=status_name,
    ).order_by('-changed_at').first()
    if log:
        return (timezone.now() - log.changed_at).days
    return (timezone.now() - application.application_date).days


class CreditCommitteeBaseView(APIView):
    """
    Base view for all Credit Committee endpoints.
    Requires JWT authentication and Credit Committee role.
    """
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def check_permissions(self, request):
        """Check if user has Credit Committee role."""
        super().check_permissions(request)

        user = request.user
        if not user.role or user.role.name != 'Credit Committee':
            self.permission_denied(
                request,
                message='You do not have permission to access the Credit Committee module.'
            )


# =============================================================================
# Dashboard API
# =============================================================================

class DashboardView(CreditCommitteeBaseView):
    """
    GET /api/credit-committee/dashboard/
    Returns dashboard statistics and recent data.
    """
    def get(self, request):
        stats = CreditCommitteeDashboardService.get_dashboard_stats()
        recent_applications = CreditCommitteeDashboardService.get_recent_applications(limit=5)
        recent_decisions = CreditCommitteeDashboardService.get_recent_decisions(limit=5)

        return Response({
            'stats': stats,
            'recent_applications': [
                {
                    'id': app.id,
                    'user_application_number': app.user_application_number,
                    'applicant': {
                        'name': f"{app.user.firstname} {app.user.lastname}",
                        'email': app.user.email,
                    },
                    'loan_type': app.loan_type.loan_name,
                    'amount_requested': str(app.amount_requested),
                    'application_date': app.application_date.isoformat(),
                }
                for app in recent_applications
            ],
            'recent_decisions': [
                {
                    'id': d.id,
                    'application_id': d.application.id,
                    'applicant': f"{d.application.user.firstname} {d.application.user.lastname}",
                    'decision': d.decision,
                    'decided_by': f"{d.decided_by.firstname} {d.decided_by.lastname}",
                    'decided_at': d.decided_at.isoformat(),
                }
                for d in recent_decisions
            ],
        })


# =============================================================================
# Applications API
# =============================================================================

class ApplicationListView(CreditCommitteeBaseView):
    """
    GET /api/credit-committee/applications/
    Returns list of applications pending Credit Committee decision.
    """
    def get(self, request):
        applications = CreditCommitteeApplicationService.get_pending_applications()

        return Response({
            'applications': [
                {
                    'id': app.id,
                    'user_application_number': app.user_application_number,
                    'applicant': {
                        'id': app.user.id,
                        'name': f"{app.user.firstname} {app.user.lastname}",
                        'email': app.user.email,
                    },
                    'loan_type': app.loan_type.loan_name,
                    'amount_requested': str(app.amount_requested),
                    'monthly_amortization': str(app.monthly_amortization) if app.monthly_amortization else None,
                    'net_salary': str(app.net_salary) if app.net_salary else None,
                    'term_months': app.term_months,
                    'application_date': app.application_date.isoformat(),
                    'status': app.current_status.status_name if app.current_status else None,
                    # Get DTI and risk level from treasurer evaluation
                    'dti_ratio': str(app.treasurer_evaluations.first().dti_ratio)
                        if app.treasurer_evaluations.exists() else None,
                    'risk_level': 'High' if app.treasurer_evaluations.exists() and
                        app.treasurer_evaluations.first().dti_ratio > 40 else
                        ('Medium' if app.treasurer_evaluations.exists() and
                         app.treasurer_evaluations.first().dti_ratio > 30 else 'Low'),
                    'bookkeeper_status': 'Verified',
                    'treasurer_status': 'Recommended',
                    'days_in_stage': _days_in_stage(app, 'Pending Credit Committee'),
                }
                for app in applications
            ],
            'count': applications.count(),
        })


class ApplicationDetailView(CreditCommitteeBaseView):
    """
    GET /api/credit-committee/applications/<id>/
    Returns detailed information about a single application.
    """
    def get(self, request, pk):
        application = CreditCommitteeApplicationService.get_application_by_id(pk)

        if not application:
            return Response(
                {'error': 'Application not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        can_decide = (
            application.current_status and
            application.current_status.status_name == 'Pending Credit Committee'
        )

        # Get latest treasurer evaluation for financial assessment
        treasurer_eval = application.treasurer_evaluations.first() if application.treasurer_evaluations.exists() else None

        return Response({
            'application': {
                'id': application.id,
                'user_application_number': application.user_application_number,
                'applicant': {
                    'id': application.user.id,
                    'name': f"{application.user.firstname} {application.user.lastname}",
                    'email': application.user.email,
                    'status': application.user.status,
                    'date_joined': application.user.date_joined.isoformat(),
                },
                'loan_type': {
                    'name': application.loan_type.loan_name,
                    'interest_rate': str(application.loan_type.interest_rate),
                },
                'amount_requested': str(application.amount_requested),
                'term_months': application.term_months,
                'monthly_amortization': str(application.monthly_amortization) if application.monthly_amortization else None,
                'total_payable': str(application.total_payable) if application.total_payable else None,
                'purpose': application.purpose,
                'application_date': application.application_date.isoformat(),
                'status': application.current_status.status_name if application.current_status else None,
            },
            'financial_assessment': {
                'net_salary': str(treasurer_eval.net_salary) if treasurer_eval else None,
                'monthly_amortization': str(treasurer_eval.computed_monthly_amortization) if treasurer_eval else None,
                'dti_ratio': str(treasurer_eval.dti_ratio) if treasurer_eval else None,
                'risk_level': 'High' if treasurer_eval and treasurer_eval.dti_ratio > 40 else
                    ('Medium' if treasurer_eval and treasurer_eval.dti_ratio > 30 else 'Low'),
                'treasurer_recommendation': treasurer_eval.recommendation if treasurer_eval else None,
                'treasurer_remarks': treasurer_eval.remarks if treasurer_eval else None,
                'evaluated_by': f"{treasurer_eval.evaluated_by.firstname} {treasurer_eval.evaluated_by.lastname}"
                    if treasurer_eval else None,
                'evaluated_at': treasurer_eval.evaluated_at.isoformat() if treasurer_eval else None,
            } if treasurer_eval else None,
            'documents': [
                {
                    'id': doc.id,
                    'document_type': doc.document_type,
                    'file_path': doc.file_path,
                    'uploaded_at': doc.uploaded_at.isoformat() if doc.uploaded_at else None,
                    'verified': doc.verified,
                }
                for doc in application.documents.all()
            ],
            'comakers': [
                {
                    'id': comaker.id,
                    'name': f"{comaker.user.firstname} {comaker.user.lastname}",
                    'email': comaker.user.email,
                    'agreed_at': comaker.agreed_at.isoformat(),
                }
                for comaker in application.comakers.all()
            ],
            'bookkeeper_verifications': [
                {
                    'id': v.id,
                    'action': v.action,
                    'verified_by': f"{v.verified_by.firstname} {v.verified_by.lastname}",
                    'verified_at': v.verified_at.isoformat(),
                    'notes': v.notes,
                }
                for v in application.bookkeeper_verifications.all()
            ],
            'treasurer_evaluations': [
                {
                    'id': e.id,
                    'recommendation': e.recommendation,
                    'dti_ratio': str(e.dti_ratio),
                    'net_salary': str(e.net_salary),
                    'evaluated_by': f"{e.evaluated_by.firstname} {e.evaluated_by.lastname}",
                    'evaluated_at': e.evaluated_at.isoformat(),
                    'remarks': e.remarks,
                }
                for e in application.treasurer_evaluations.all()
            ],
            'decision_history': [
                {
                    'id': d.id,
                    'decision': d.decision,
                    'remarks': d.remarks,
                    'meeting_date': d.meeting_date.isoformat(),
                    'decided_by': f"{d.decided_by.firstname} {d.decided_by.lastname}",
                    'decided_at': d.decided_at.isoformat(),
                }
                for d in application.credit_committee_decisions.all()
            ],
            'can_decide': can_decide,
            'committee_member': {
                'name': f"{request.user.firstname} {request.user.lastname}",
                'email': request.user.email,
            }
        })


class SubmitDecisionView(CreditCommitteeBaseView):
    """
    POST /api/credit-committee/applications/<id>/decide/
    Submit a Credit Committee decision on an application.
    """
    def post(self, request, pk):
        application = get_object_or_404(LoanApplication, pk=pk)

        # Validate status
        if not application.current_status or application.current_status.status_name != 'Pending Credit Committee':
            return Response(
                {'error': 'This application cannot be decided on.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate required fields
        decision = request.data.get('decision')
        remarks = request.data.get('remarks', '').strip()
        meeting_date_str = request.data.get('meeting_date')
        rejection_category = (request.data.get('rejection_category') or '').strip() or None

        if not decision:
            return Response(
                {'error': 'Decision is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if decision not in ['approved', 'rejected', 'returned']:
            return Response(
                {'error': 'Invalid decision value. Must be: approved, rejected, or returned'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate rejection category when decision is rejected
        if decision == 'rejected':
            if rejection_category == 'others' and not remarks:
                return Response(
                    {'error': 'Please provide remarks when selecting "Others".'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not rejection_category and not remarks:
                return Response(
                    {'error': 'Remarks are required for rejection decisions.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if not remarks:
            return Response(
                {'error': 'Remarks are required for all decisions.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not meeting_date_str:
            return Response(
                {'error': 'Meeting date is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            meeting_date = datetime.strptime(meeting_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Invalid meeting date format. Use YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get IP address
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0].strip()
        else:
            ip_address = request.META.get('REMOTE_ADDR')

        try:
            cc_decision = DecisionService.submit_decision(
                application=application,
                committee_member=request.user,
                decision=decision,
                rejection_category=rejection_category if decision == 'rejected' else None,
                remarks=remarks,
                meeting_date=meeting_date,
                ip_address=ip_address
            )

            decision_text = {
                'approved': 'approved',
                'rejected': 'rejected',
                'returned': 'returned to Treasurer'
            }

            return Response({
                'message': f'Application #{application.id} has been {decision_text[decision]}.',
                'decision_id': cc_decision.id,
                'new_status': application.current_status.status_name if application.current_status else None,
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# =============================================================================
# Decision History API
# =============================================================================

class DecisionHistoryView(CreditCommitteeBaseView):
    """
    GET /api/credit-committee/decisions/
    Returns history of all Credit Committee decisions.
    Query params: start_date, end_date, decision
    """
    def get(self, request):
        filters = {
            'start_date': request.query_params.get('start_date'),
            'end_date': request.query_params.get('end_date'),
            'decision': request.query_params.get('decision'),
        }
        # Remove None values
        filters = {k: v for k, v in filters.items() if v}

        decisions = DecisionService.get_decision_history(filters if filters else None)

        return Response({
            'decisions': [
                {
                    'id': d.id,
                    'application_id': d.application.id,
                    'applicant': {
                        'name': f"{d.application.user.firstname} {d.application.user.lastname}",
                        'email': d.application.user.email,
                    },
                    'loan_type': d.application.loan_type.loan_name,
                    'amount_requested': str(d.application.amount_requested),
                    'decision': d.decision,
                    'remarks': d.remarks,
                    'meeting_date': d.meeting_date.isoformat(),
                    'decided_by': {
                        'name': f"{d.decided_by.firstname} {d.decided_by.lastname}",
                        'email': d.decided_by.email,
                    },
                    'decided_at': d.decided_at.isoformat(),
                }
                for d in decisions
            ],
            'count': decisions.count(),
        })


# =============================================================================
# Reports API
# =============================================================================

class ReportsView(CreditCommitteeBaseView):
    """
    GET /api/credit-committee/reports/
    Returns various report data.
    Query params: type (approval_stats, monthly, loan_type, high_risk, member_stats)
    """
    def get(self, request):
        report_type = request.query_params.get('type', 'summary')

        # Get loan types for filter dropdown
        loan_types = list(LoanType.objects.filter(is_active=True).values('id', 'loan_name'))

        if report_type == 'summary':
            # Return all summary data
            approval_stats = CreditCommitteeReportService.get_approval_stats(days=30)
            monthly_stats = CreditCommitteeReportService.get_monthly_stats(months=6)
            loan_type_stats = CreditCommitteeReportService.get_decisions_by_loan_type()
            high_risk_stats = CreditCommitteeReportService.get_high_risk_approval_ratio()

            return Response({
                'report_type': 'summary',
                'loan_types': loan_types,
                'approval_stats': approval_stats,
                'monthly_stats': monthly_stats,
                'loan_type_distribution': loan_type_stats,
                'high_risk_stats': high_risk_stats,
            })

        elif report_type == 'approval_stats':
            days = int(request.query_params.get('days', 30))
            stats = CreditCommitteeReportService.get_approval_stats(days=days)

            return Response({
                'report_type': 'approval_stats',
                'stats': stats,
            })

        elif report_type == 'monthly':
            months = int(request.query_params.get('months', 6))
            stats = CreditCommitteeReportService.get_monthly_stats(months=months)

            return Response({
                'report_type': 'monthly',
                'stats': stats,
            })

        elif report_type == 'loan_type':
            stats = CreditCommitteeReportService.get_decisions_by_loan_type()

            return Response({
                'report_type': 'loan_type',
                'stats': stats,
            })

        elif report_type == 'high_risk':
            stats = CreditCommitteeReportService.get_high_risk_approval_ratio()

            return Response({
                'report_type': 'high_risk',
                'stats': stats,
            })

        elif report_type == 'member_stats':
            days = int(request.query_params.get('days', 30))
            stats = CreditCommitteeReportService.get_committee_member_stats(days=days)

            return Response({
                'report_type': 'member_stats',
                'stats': stats,
            })

        return Response(
            {'error': 'Invalid report type.'},
            status=status.HTTP_400_BAD_REQUEST
        )


# =============================================================================
# Notifications API
# =============================================================================

class NotificationListView(CreditCommitteeBaseView):
    """
    GET /api/credit-committee/notifications/
    Returns all notifications for the user.
    """
    def get(self, request):
        notifications = CreditCommitteeNotificationService.get_notifications(request.user)
        unread_count = CreditCommitteeNotificationService.get_unread_count(request.user)

        return Response({
            'notifications': [
                {
                    'id': n.id,
                    'title': n.title,
                    'message': n.message,
                    'notification_type': n.notification_type,
                    'is_read': n.is_read,
                    'created_at': n.created_at.isoformat(),
                    'read_at': n.read_at.isoformat() if n.read_at else None,
                    'related_application_id': n.related_application_id,
                }
                for n in notifications
            ],
            'unread_count': unread_count,
        })


class MarkNotificationReadView(CreditCommitteeBaseView):
    """
    POST /api/credit-committee/notifications/<id>/read/
    Mark a single notification as read.
    """
    def post(self, request, pk):
        success = CreditCommitteeNotificationService.mark_as_read(pk, request.user)

        if success:
            return Response({'message': 'Notification marked as read.'})
        else:
            return Response(
                {'error': 'Notification not found.'},
                status=status.HTTP_404_NOT_FOUND
            )


class MarkAllNotificationsReadView(CreditCommitteeBaseView):
    """
    POST /api/credit-committee/notifications/mark-all-read/
    Mark all notifications as read.
    """
    def post(self, request):
        CreditCommitteeNotificationService.mark_all_as_read(request.user)
        return Response({'message': 'All notifications marked as read.'})


class UnreadNotificationCountView(CreditCommitteeBaseView):
    """
    GET /api/credit-committee/notifications/unread-count/
    Returns count of unread notifications.
    """
    def get(self, request):
        count = CreditCommitteeNotificationService.get_unread_count(request.user)
        return Response({'unread_count': count})


class DeleteNotificationView(CreditCommitteeBaseView):
    """POST /api/credit-committee/notifications/<id>/delete/"""
    def post(self, request, pk):
        if CreditCommitteeNotificationService.delete_notification(pk, request.user):
            return Response({'message': 'Notification deleted.'})
        return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)


class ArchiveNotificationView(CreditCommitteeBaseView):
    """POST /api/credit-committee/notifications/<id>/archive/"""
    def post(self, request, pk):
        if CreditCommitteeNotificationService.archive_notification(pk, request.user):
            return Response({'message': 'Notification archived.'})
        return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)


# =============================================================================
# Settings API
# =============================================================================

class ProfileView(CreditCommitteeBaseView):
    """
    GET /api/credit-committee/settings/profile/
    Returns current user profile information.

    PUT /api/credit-committee/settings/profile/
    Updates user profile information.
    """
    def get(self, request):
        user = request.user
        return Response({
            'profile': {
                'id': user.id,
                'firstname': user.firstname,
                'lastname': user.lastname,
                'email': user.email,
                'profile_picture': request.build_absolute_uri(user.profile_picture.url) if user.profile_picture else None,
                'role': user.role.name if user.role else None,
                'date_joined': user.date_joined.isoformat(),
            }
        })

    def put(self, request):
        user = request.user
        data = request.data

        # Update allowed fields
        if 'firstname' in data:
            user.firstname = data['firstname'].strip()
        if 'lastname' in data:
            user.lastname = data['lastname'].strip()

        user.save()

        return Response({
            'message': 'Profile updated successfully.',
            'profile': {
                'id': user.id,
                'firstname': user.firstname,
                'lastname': user.lastname,
                'email': user.email,
                'profile_picture': request.build_absolute_uri(user.profile_picture.url) if user.profile_picture else None,
            }
        })


class ProfilePictureView(CreditCommitteeBaseView):
    """
    POST /api/credit-committee/settings/profile/picture/
    Upload or update profile picture.

    DELETE /api/credit-committee/settings/profile/picture/
    Remove profile picture.
    """
    def post(self, request):
        user = request.user

        if 'profile_picture' not in request.FILES:
            return Response(
                {'error': 'No image file provided.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Delete old picture if exists
        if user.profile_picture:
            user.profile_picture.delete(save=False)

        user.profile_picture = request.FILES['profile_picture']
        user.save()

        return Response({
            'message': 'Profile picture updated successfully.',
            'profile_picture': request.build_absolute_uri(user.profile_picture.url)
        })

    def delete(self, request):
        user = request.user

        if user.profile_picture:
            user.profile_picture.delete(save=False)
            user.profile_picture = None
            user.save()

        return Response({'message': 'Profile picture removed successfully.'})


class ChangePasswordView(CreditCommitteeBaseView):
    """
    POST /api/credit-committee/settings/change-password/
    Change user password.
    """
    def post(self, request):
        user = request.user
        data = request.data

        old_password = data.get('old_password', '')
        new_password = data.get('new_password', '')
        confirm_password = data.get('confirm_password', '')

        # Validate inputs
        if not old_password or not new_password or not confirm_password:
            return Response(
                {'error': 'All password fields are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verify old password
        if not check_password(old_password, user.password):
            return Response(
                {'error': 'Current password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check password match
        if new_password != confirm_password:
            return Response(
                {'error': 'New passwords do not match.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check password length
        if len(new_password) < 8:
            return Response(
                {'error': 'Password must be at least 8 characters long.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update password
        user.set_password(new_password)
        user.save()

        return Response({'message': 'Password changed successfully.'})


class NotificationPreferencesView(CreditCommitteeBaseView):
    """
    GET /api/credit-committee/settings/notification-preferences/
    Returns current notification preferences.

    PUT /api/credit-committee/settings/notification-preferences/
    Updates notification preferences.
    """
    def get(self, request):
        user = request.user

        # Get or create preferences
        preferences, _ = UserPreferences.objects.get_or_create(user=user)

        return Response({
            'preferences': {
                'email_notifications': preferences.email_notifications,
                'in_app_notifications': preferences.in_app_notifications,
            }
        })

    def put(self, request):
        user = request.user
        data = request.data

        # Get or create preferences
        preferences, _ = UserPreferences.objects.get_or_create(user=user)

        # Update preferences
        if 'email_notifications' in data:
            preferences.email_notifications = bool(data['email_notifications'])
        if 'in_app_notifications' in data:
            preferences.in_app_notifications = bool(data['in_app_notifications'])

        preferences.save()

        return Response({
            'message': 'Notification preferences updated successfully.',
            'preferences': {
                'email_notifications': preferences.email_notifications,
                'in_app_notifications': preferences.in_app_notifications,
            }
        })


class DeactivateAccountView(CreditCommitteeBaseView):
    """
    POST /api/credit-committee/settings/deactivate-account/
    Deactivate user account (disable login, keep data).
    """
    def post(self, request):
        user = request.user
        password = request.data.get('password', '')

        # Verify password for security
        if not password:
            return Response(
                {'error': 'Password is required to deactivate account.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not check_password(password, user.password):
            return Response(
                {'error': 'Incorrect password.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Deactivate account
        user.status = 'suspended'
        user.is_active = False
        user.save()

        return Response({
            'message': 'Your account has been deactivated. Contact an administrator to reactivate.'
        })


class LogoutEverywhereView(CreditCommitteeBaseView):
    """
    POST /api/credit-committee/settings/logout-everywhere/
    Invalidate all refresh tokens (logout from all devices).
    """
    def post(self, request):
        user = request.user

        try:
            # Get all outstanding tokens for this user and blacklist them
            tokens = OutstandingToken.objects.filter(user=user)
            for token in tokens:
                try:
                    BlacklistedToken.objects.get_or_create(token=token)
                except Exception:
                    pass

            return Response({
                'message': 'Successfully logged out from all devices.'
            })
        except Exception as e:
            return Response(
                {'error': 'Failed to logout from all devices.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
