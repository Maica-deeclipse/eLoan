"""
Superadmin Module API Views

Handles: violations, disciplinary actions, terminations, member oversight,
and security alert notifications.
Only accessible to users with is_superuser=True or role='Super Administrator'.
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.utils import timezone

from .models import Violation, DisciplinaryAction, TerminationRecord
from users.models import User, Applicant, AdminUser

STAFF_ROLES = ['Bookkeeper', 'Treasurer', 'Credit Committee', 'Account Member Officer']


# ---------------------------------------------------------------------------
# Base View (Super Admin only)
# ---------------------------------------------------------------------------

class SuperAdminBaseView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        user = request.user
        is_superadmin = user.is_superuser or (user.role and user.role.name == 'Super Administrator')
        if not is_superadmin:
            self.permission_denied(
                request,
                message='Only Super Administrators can access this module.'
            )


# ---------------------------------------------------------------------------
# Stats Dashboard
# ---------------------------------------------------------------------------

class StatsView(SuperAdminBaseView):
    """GET /api/superadmin/stats/ — aggregate counts for the dashboard."""

    def get(self, request):
        from loans.models import LoanApplication

        total_staff = User.objects.filter(
            role__name__in=STAFF_ROLES, is_superuser=False
        ).count()
        pending_approvals = User.objects.filter(
            role__name__in=STAFF_ROLES, account_status='pending'
        ).count()
        suspended_staff = User.objects.filter(
            role__name__in=STAFF_ROLES, status='suspended'
        ).count()
        total_members = Applicant.objects.count()
        active_members = Applicant.objects.filter(membership_status='active').count()
        open_violations = Violation.objects.filter(status='open').count()
        total_violations = Violation.objects.count()
        total_disciplinary = DisciplinaryAction.objects.count()
        total_terminations = TerminationRecord.objects.count()

        try:
            total_loans = LoanApplication.objects.count()
            pending_loans = LoanApplication.objects.filter(status='pending').count()
        except Exception:
            total_loans = 0
            pending_loans = 0

        return Response({
            'staff': {
                'total': total_staff,
                'pending_approvals': pending_approvals,
                'suspended': suspended_staff,
            },
            'members': {
                'total': total_members,
                'active': active_members,
            },
            'violations': {
                'open': open_violations,
                'total': total_violations,
            },
            'disciplinary': {
                'total': total_disciplinary,
                'terminations': total_terminations,
            },
            'loans': {
                'total': total_loans,
                'pending': pending_loans,
            },
        })


# ---------------------------------------------------------------------------
# Staff Management
# ---------------------------------------------------------------------------

class StaffListView(SuperAdminBaseView):
    """GET /api/superadmin/staff/ — list all staff with optional filters."""

    def get(self, request):
        account_status = request.query_params.get('account_status')
        role_name = request.query_params.get('role')

        qs = AdminUser.objects.filter(
            role__name__in=STAFF_ROLES, is_superuser=False
        ).select_related('role', 'approved_by').order_by('-date_joined')

        if account_status:
            qs = qs.filter(account_status=account_status)
        if role_name:
            qs = qs.filter(role__name=role_name)

        return Response([self._serialize_staff(u) for u in qs])

    @staticmethod
    def _serialize_staff(u):
        return {
            'id': u.id,
            'name': f"{u.firstname} {u.lastname}",
            'email': u.email,
            'role': u.role.name if u.role else None,
            'employee_id': u.employee_id,
            'account_status': u.account_status,
            'status': u.status,
            'date_joined': u.date_joined.isoformat(),
            'approved_by': f"{u.approved_by.firstname} {u.approved_by.lastname}" if u.approved_by else None,
            'approved_at': u.approved_at.isoformat() if u.approved_at else None,
            'rejection_reason': u.rejection_reason,
        }


class StaffActionView(SuperAdminBaseView):
    """POST /api/superadmin/staff/<id>/<action>/ — approve/reject/suspend/reactivate."""

    VALID_ACTIONS = ['approve', 'reject', 'suspend', 'reactivate']

    def post(self, request, user_id, action):
        if action not in self.VALID_ACTIONS:
            return Response(
                {'error': f"Invalid action. Choose from: {', '.join(self.VALID_ACTIONS)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            staff = AdminUser.objects.select_related('role').get(
                pk=user_id, role__name__in=STAFF_ROLES, is_superuser=False
            )
        except AdminUser.DoesNotExist:
            return Response({'error': 'Staff user not found.'}, status=status.HTTP_404_NOT_FOUND)

        if action == 'approve':
            staff.account_status = 'approved'
            staff.status = 'active'
            staff.approved_by = request.user
            staff.approved_at = timezone.now()
            staff.rejection_reason = None
            staff.save(update_fields=['account_status', 'status', 'approved_by', 'approved_at', 'rejection_reason'])
            return Response({'message': f"{staff.firstname} {staff.lastname}'s account has been approved."})

        elif action == 'reject':
            reason = request.data.get('reason', '').strip()
            if not reason:
                return Response({'error': 'Rejection reason is required.'}, status=status.HTTP_400_BAD_REQUEST)
            staff.account_status = 'rejected'
            staff.rejection_reason = reason
            staff.save(update_fields=['account_status', 'rejection_reason'])
            return Response({'message': f"{staff.firstname} {staff.lastname}'s account has been rejected."})

        elif action == 'suspend':
            staff.status = 'suspended'
            staff.save(update_fields=['status'])
            return Response({'message': f"{staff.firstname} {staff.lastname} has been suspended."})

        elif action == 'reactivate':
            staff.status = 'active'
            staff.account_status = 'approved'
            staff.save(update_fields=['status', 'account_status'])
            return Response({'message': f"{staff.firstname} {staff.lastname} has been reactivated."})


# ---------------------------------------------------------------------------
# Violations
# ---------------------------------------------------------------------------

class ViolationListView(SuperAdminBaseView):
    """List all violations or create a new one."""

    def get(self, request):
        member_id = request.query_params.get('member_id')
        severity = request.query_params.get('severity')
        qs = Violation.objects.select_related('member', 'logged_by').order_by('-logged_at')
        if member_id:
            qs = qs.filter(member_id=member_id)
        if severity:
            qs = qs.filter(severity=severity)

        return Response([self._serialize_violation(v) for v in qs])

    def post(self, request):
        member_id = request.data.get('member_id')
        violation_type = request.data.get('violation_type')
        description = request.data.get('description', '').strip()
        date_of_violation = request.data.get('date_of_violation')
        severity = request.data.get('severity', 'minor')

        if not all([member_id, violation_type, description, date_of_violation]):
            return Response(
                {'error': 'member_id, violation_type, description, and date_of_violation are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            member = Applicant.objects.get(pk=member_id)
        except Applicant.DoesNotExist:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        violation = Violation.objects.create(
            member=member,
            violation_type=violation_type,
            description=description,
            date_of_violation=date_of_violation,
            severity=severity,
            logged_by=request.user,
        )

        return Response(self._serialize_violation(violation), status=status.HTTP_201_CREATED)

    @staticmethod
    def _serialize_violation(v):
        return {
            'id': v.id,
            'member_id': v.member.id,
            'member_name': f"{v.member.firstname} {v.member.lastname}",
            'member_email': v.member.email,
            'violation_type': v.violation_type,
            'violation_type_display': v.get_violation_type_display(),
            'description': v.description,
            'date_of_violation': v.date_of_violation.isoformat(),
            'severity': v.severity,
            'severity_display': v.get_severity_display(),
            'status': v.status,
            'logged_by': f"{v.logged_by.firstname} {v.logged_by.lastname}" if v.logged_by else None,
            'logged_at': v.logged_at.isoformat(),
        }


class ViolationDetailView(SuperAdminBaseView):
    def get(self, request, pk):
        try:
            v = Violation.objects.select_related('member', 'logged_by').get(pk=pk)
        except Violation.DoesNotExist:
            return Response({'error': 'Violation not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ViolationListView._serialize_violation(v))

    def patch(self, request, pk):
        try:
            v = Violation.objects.get(pk=pk)
        except Violation.DoesNotExist:
            return Response({'error': 'Violation not found.'}, status=status.HTTP_404_NOT_FOUND)

        v.status = request.data.get('status', v.status)
        v.description = request.data.get('description', v.description)
        v.save(update_fields=['status', 'description', 'updated_at'])
        return Response({'message': 'Violation updated.'})


# ---------------------------------------------------------------------------
# Disciplinary Actions
# ---------------------------------------------------------------------------

class DisciplinaryActionListView(SuperAdminBaseView):
    def get(self, request):
        member_id = request.query_params.get('member_id')
        qs = DisciplinaryAction.objects.select_related('member', 'decided_by').order_by('-decided_at')
        if member_id:
            qs = qs.filter(member_id=member_id)
        return Response([self._serialize_action(a) for a in qs])

    def post(self, request):
        member_id = request.data.get('member_id')
        action_type = request.data.get('action_type')
        reason = request.data.get('reason', '').strip()
        effective_date = request.data.get('effective_date')
        violation_ids = request.data.get('violation_ids', [])
        suspension_end_date = request.data.get('suspension_end_date')
        notes = request.data.get('notes', '')

        if not all([member_id, action_type, reason]):
            return Response(
                {'error': 'member_id, action_type, and reason are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        valid_actions = [c[0] for c in DisciplinaryAction.ACTION_TYPE_CHOICES]
        if action_type not in valid_actions:
            return Response(
                {'error': f"Invalid action_type. Choose from: {', '.join(valid_actions)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            member = Applicant.objects.get(pk=member_id)
        except Applicant.DoesNotExist:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        action = DisciplinaryAction.objects.create(
            member=member,
            action_type=action_type,
            reason=reason,
            effective_date=effective_date or timezone.now().date(),
            decided_by=request.user,
            suspension_end_date=suspension_end_date or None,
            notes=notes,
        )

        # Link violations
        if violation_ids:
            violations = Violation.objects.filter(pk__in=violation_ids, member=member)
            action.violations.set(violations)

        # Apply the action to update member status
        action.apply()

        return Response(self._serialize_action(action), status=status.HTTP_201_CREATED)

    @staticmethod
    def _serialize_action(a):
        return {
            'id': a.id,
            'member_id': a.member.id,
            'member_name': f"{a.member.firstname} {a.member.lastname}",
            'member_email': a.member.email,
            'action_type': a.action_type,
            'action_type_display': a.get_action_type_display(),
            'reason': a.reason,
            'effective_date': a.effective_date.isoformat(),
            'suspension_end_date': a.suspension_end_date.isoformat() if a.suspension_end_date else None,
            'decided_by': f"{a.decided_by.firstname} {a.decided_by.lastname}" if a.decided_by else None,
            'decided_at': a.decided_at.isoformat(),
            'notes': a.notes,
            'current_member_status': a.member.membership_status,
        }


# ---------------------------------------------------------------------------
# Termination
# ---------------------------------------------------------------------------

class TerminateMemberView(SuperAdminBaseView):
    """Formally terminate a member's membership."""

    def post(self, request, member_id):
        termination_type = request.data.get('termination_type', 'disciplinary')
        reason = request.data.get('reason', '').strip()

        if not reason:
            return Response({'error': 'Reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        valid_types = [c[0] for c in TerminationRecord.TERMINATION_TYPE_CHOICES]
        if termination_type not in valid_types:
            return Response(
                {'error': f"Invalid termination_type. Choose from: {', '.join(valid_types)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            member = Applicant.objects.get(pk=member_id)
        except Applicant.DoesNotExist:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        if hasattr(member, 'termination_record'):
            return Response({'error': 'Member is already terminated.'}, status=status.HTTP_400_BAD_REQUEST)

        record = TerminationRecord.objects.create(
            member=member,
            termination_type=termination_type,
            reason=reason,
            effective_date=request.data.get('effective_date') or timezone.now().date(),
            processed_by=request.user,
        )

        # Update member status
        status_map = {
            'disciplinary': 'terminated',
            'voluntary': 'voluntary_withdrawal',
            'deceased': 'deceased',
        }
        member.membership_status = status_map.get(termination_type, 'terminated')
        member.save(update_fields=['membership_status', 'profile_updated_at'])

        # Disable user account (except deceased)
        if termination_type != 'deceased':
            member.status = 'suspended'
            member.save(update_fields=['status'])

        return Response({
            'message': f"Member {member.email} has been {member.get_membership_status_display().lower()}.",
            'termination_type': record.termination_type,
            'membership_status': member.membership_status,
            'effective_date': record.effective_date.isoformat(),
        }, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Member Overview (Super Admin sees all members with full details)
# ---------------------------------------------------------------------------

class MemberOverviewView(SuperAdminBaseView):
    def get(self, request):
        membership_status = request.query_params.get('membership_status')
        qs = Applicant.objects.order_by('-member_since')
        if membership_status:
            qs = qs.filter(membership_status=membership_status)

        return Response([
            {
                'id': m.id,
                'user_id': m.id,
                'name': f"{m.firstname} {m.lastname}",
                'email': m.email,
                'membership_type': m.membership_type,
                'membership_status': m.membership_status,
                'membership_status_display': m.get_membership_status_display(),
                'verified_employment_status': m.verified_employment_status,
                'fixed_deposit': str(m.fixed_deposit) if m.fixed_deposit is not None else None,
                'violation_count': m.violations.filter(status='open').count(),
                'member_since': m.member_since.isoformat() if m.member_since else None,
            }
            for m in qs
        ])


class MemberCaseHistoryView(SuperAdminBaseView):
    """Full case history for a member: violations + disciplinary actions."""

    def get(self, request, member_id):
        try:
            member = Applicant.objects.get(pk=member_id)
        except Applicant.DoesNotExist:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        violations = Violation.objects.filter(member=member).select_related('logged_by').order_by('-logged_at')
        actions = DisciplinaryAction.objects.filter(member=member).select_related('decided_by').order_by('-decided_at')

        termination_record = None
        if hasattr(member, 'termination_record'):
            tr = member.termination_record
            termination_record = {
                'termination_type': tr.termination_type,
                'termination_type_display': tr.get_termination_type_display(),
                'reason': tr.reason,
                'effective_date': tr.effective_date.isoformat(),
                'processed_by': f"{tr.processed_by.firstname} {tr.processed_by.lastname}" if tr.processed_by else None,
                'processed_at': tr.processed_at.isoformat(),
            }

        return Response({
            'member': {
                'id': member.id,
                'name': f"{member.firstname} {member.lastname}",
                'email': member.email,
                'membership_status': member.membership_status,
                'membership_status_display': member.get_membership_status_display(),
                'open_violations': violations.filter(status='open').count(),
                'total_violations': violations.count(),
            },
            'violations': [ViolationListView._serialize_violation(v) for v in violations],
            'disciplinary_actions': [DisciplinaryActionListView._serialize_action(a) for a in actions],
            'termination_record': termination_record,
            'suggested_action': _suggest_action(violations),
        })


class MemberFaceVerificationsView(SuperAdminBaseView):
    """GET /api/superadmin/members/<id>/face-verifications/ — all face checks for a member."""

    def get(self, request, member_id):
        from loans.models import FaceVerification
        from django.conf import settings as django_settings

        try:
            member = Applicant.objects.get(pk=member_id)
        except Applicant.DoesNotExist:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        verifications = FaceVerification.objects.filter(
            loan_application__user=member.user_ptr
        ).select_related('loan_application').order_by('-created_at')

        result = []
        for fv in verifications:
            id_photo_url = None
            if fv.id_photo_path:
                id_photo_url = request.build_absolute_uri(django_settings.MEDIA_URL + fv.id_photo_path)
            selfie_url = None
            if fv.captured_image_path:
                selfie_url = request.build_absolute_uri(django_settings.MEDIA_URL + fv.captured_image_path)
            result.append({
                'id': fv.id,
                'loan_application_id': fv.loan_application_id,
                'loan_type': fv.loan_application.loan_type.loan_name if fv.loan_application.loan_type_id else '—',
                'id_photo_url': id_photo_url,
                'selfie_url': selfie_url,
                'face_detected_in_id': fv.face_detected_in_id,
                'face_detected_in_selfie': fv.face_detected_in_selfie,
                'similarity_score': float(fv.similarity_score) if fv.similarity_score is not None else None,
                'is_match': fv.is_match,
                'comparison_model': fv.comparison_model,
                'verification_status': fv.verification_status,
                'error_message': fv.error_message,
                'processed_at': fv.processed_at.isoformat() if fv.processed_at else None,
            })

        return Response({'member_id': member_id, 'verifications': result})


def _suggest_action(violations):
    """Suggest a disciplinary action based on violation count and severity."""
    open_violations = violations.filter(status='open')
    severe_count = open_violations.filter(severity='severe').count()
    total_open = open_violations.count()

    if severe_count >= 1:
        return {'action': 'termination', 'reason': 'Severe violation detected.'}
    if total_open >= 3:
        return {'action': 'suspension', 'reason': f'{total_open} open violations.'}
    if total_open >= 1:
        return {'action': 'warning', 'reason': f'{total_open} open violation(s).'}
    return {'action': None, 'reason': 'No open violations.'}


# ---------------------------------------------------------------------------
# Notifications (Super Administrator only — security alerts & system alerts)
# ---------------------------------------------------------------------------

class NotificationListView(SuperAdminBaseView):
    """GET /api/superadmin/notifications/ — all notifications for the logged-in superadmin."""

    def get(self, request):
        from bookkeeper.models import Notification
        notifications = Notification.objects.filter(user=request.user, is_deleted=False, is_archived=False).order_by('-created_at')
        unread_count = notifications.filter(is_read=False).count()
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


class MarkNotificationReadView(SuperAdminBaseView):
    """POST /api/superadmin/notifications/<id>/read/ — mark one notification as read."""

    def post(self, request, pk):
        from bookkeeper.models import Notification
        try:
            notification = Notification.objects.get(pk=pk, user=request.user)
            notification.mark_as_read()
            return Response({'message': 'Notification marked as read.'})
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)


class MarkAllNotificationsReadView(SuperAdminBaseView):
    """POST /api/superadmin/notifications/mark-all-read/ — mark all as read."""

    def post(self, request):
        from bookkeeper.models import Notification
        Notification.objects.filter(user=request.user, is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        return Response({'message': 'All notifications marked as read.'})


class UnreadNotificationCountView(SuperAdminBaseView):
    """GET /api/superadmin/notifications/unread-count/"""

    def get(self, request):
        from bookkeeper.models import Notification
        count = Notification.objects.filter(user=request.user, is_read=False, is_deleted=False, is_archived=False).count()
        return Response({'unread_count': count})


class DeleteNotificationView(SuperAdminBaseView):
    """POST /api/superadmin/notifications/<id>/delete/"""

    def post(self, request, pk):
        from bookkeeper.models import Notification
        try:
            n = Notification.objects.get(pk=pk, user=request.user)
            n.is_deleted = True
            n.save(update_fields=['is_deleted'])
            return Response({'message': 'Notification deleted.'})
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)


class ArchiveNotificationView(SuperAdminBaseView):
    """POST /api/superadmin/notifications/<id>/archive/"""

    def post(self, request, pk):
        from bookkeeper.models import Notification
        try:
            n = Notification.objects.get(pk=pk, user=request.user)
            n.is_archived = True
            n.save(update_fields=['is_archived'])
            return Response({'message': 'Notification archived.'})
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
