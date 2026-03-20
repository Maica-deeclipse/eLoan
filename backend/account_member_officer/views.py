"""
Account Member Officer Module API Views
"""

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from django.conf import settings as django_settings

from .services import (
    MemberApplicationService,
    MemberService,
    SavingsCapitalService,
    DashboardService,
    ActivityLogService,
    ReportService,
    NotificationService,
)
from users.models import User
from applicant.models import Member, Savings, SharedCapital


# ---------------------------------------------------------------------------
# Base View
# ---------------------------------------------------------------------------

class AMOBaseView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        user = request.user
        if not user.role or user.role.name != 'Account Member Officer':
            self.permission_denied(
                request,
                message='You do not have permission to access the Account Member Officer module.'
            )


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class DashboardView(AMOBaseView):
    def get(self, request):
        stats = DashboardService.get_stats()
        recent_applicants = DashboardService.get_recent_applicants()
        recent_members = DashboardService.get_recent_members()

        return Response({
            'stats': stats,
            'recent_applicants': [
                {
                    'id': u.id,
                    'name': f"{u.firstname} {u.lastname}",
                    'email': u.email,
                    'date_joined': u.date_joined.isoformat(),
                }
                for u in recent_applicants
            ],
            'recent_members': [
                {
                    'id': m.id,
                    'name': f"{m.user.firstname} {m.user.lastname}",
                    'email': m.user.email,
                    'membership_type': m.membership_type,
                    'member_since': m.member_since.isoformat(),
                }
                for m in recent_members
            ],
        })


# ---------------------------------------------------------------------------
# Member Applications (Pending Registrations)
# ---------------------------------------------------------------------------

class MemberApplicationListView(AMOBaseView):
    def get(self, request):
        filter_status = request.query_params.get('status', 'pending')
        if filter_status == 'pending':
            applicants = MemberApplicationService.get_pending_applicants()
        else:
            applicants = MemberApplicationService.get_all_applicants()
            if filter_status in ('approved', 'rejected'):
                applicants = applicants.filter(account_status=filter_status)

        return Response([
            {
                'id': u.id,
                'name': f"{u.firstname} {u.lastname}",
                'email': u.email,
                'employee_id': u.employee_id,
                'account_status': u.account_status,
                'date_joined': u.date_joined.isoformat(),
                'approved_at': u.approved_at.isoformat() if u.approved_at else None,
                'rejection_reason': u.rejection_reason,
            }
            for u in applicants
        ])


class MemberApplicationDetailView(AMOBaseView):
    def get(self, request, pk):
        try:
            u = User.objects.select_related('role', 'approved_by').get(pk=pk, role__name='Applicant')
        except User.DoesNotExist:
            return Response({'error': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'id': u.id,
            'firstname': u.firstname,
            'lastname': u.lastname,
            'email': u.email,
            'employee_id': u.employee_id,
            'account_status': u.account_status,
            'date_joined': u.date_joined.isoformat(),
            'approved_at': u.approved_at.isoformat() if u.approved_at else None,
            'approved_by': f"{u.approved_by.firstname} {u.approved_by.lastname}" if u.approved_by else None,
            'rejection_reason': u.rejection_reason,
        })


class ApproveMemberApplicationView(AMOBaseView):
    def post(self, request, pk):
        try:
            user = MemberApplicationService.approve(
                user_id=pk,
                performed_by=request.user,
                ip_address=request.META.get('REMOTE_ADDR'),
            )
        except User.DoesNotExist:
            return Response({'error': 'Applicant not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': f"{user.firstname} {user.lastname} approved successfully.",
            'account_status': user.account_status,
        })


class RejectMemberApplicationView(AMOBaseView):
    def post(self, request, pk):
        reason = request.data.get('reason', '')
        try:
            user = MemberApplicationService.reject(
                user_id=pk,
                performed_by=request.user,
                reason=reason,
                ip_address=request.META.get('REMOTE_ADDR'),
            )
        except User.DoesNotExist:
            return Response({'error': 'Applicant not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': f"{user.firstname} {user.lastname} rejected.",
            'account_status': user.account_status,
        })


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------

class MemberListView(AMOBaseView):
    def get(self, request):
        search = request.query_params.get('search', '')
        members = MemberService.get_all_members(search=search)
        return Response([
            {
                'id': m.id,
                'user_id': m.user.id,
                'name': f"{m.user.firstname} {m.user.lastname}",
                'email': m.user.email,
                'employee_id': m.user.employee_id,
                'membership_type': m.membership_type,
                'status': m.user.status,
                'total_savings': str(m.total_savings),
                'total_shared_capital': str(m.total_shared_capital),
                'member_since': m.member_since.isoformat(),
            }
            for m in members
        ])


class MemberDetailView(AMOBaseView):
    def get(self, request, pk):
        try:
            m = MemberService.get_member(pk)
        except Member.DoesNotExist:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'id': m.id,
            'user_id': m.user.id,
            'firstname': m.user.firstname,
            'lastname': m.user.lastname,
            'email': m.user.email,
            'employee_id': m.user.employee_id,
            'membership_type': m.membership_type,
            'status': m.user.status,
            'total_savings': str(m.total_savings),
            'total_shared_capital': str(m.total_shared_capital),
            'member_since': m.member_since.isoformat(),
        })


class MemberStatusView(AMOBaseView):
    def post(self, request, pk):
        new_status = request.data.get('status')
        if new_status not in ('active', 'suspended'):
            return Response({'error': 'Invalid status. Use "active" or "suspended".'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            m = Member.objects.select_related('user').get(pk=pk)
            MemberService.set_user_status(m.user.id, new_status)
        except Member.DoesNotExist:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'message': f"Member status set to {new_status}."})


# ---------------------------------------------------------------------------
# Savings & Capital
# ---------------------------------------------------------------------------

class MemberSavingsView(AMOBaseView):
    def get(self, request, pk):
        records = SavingsCapitalService.get_member_savings(pk)
        return Response([
            {
                'id': r.id,
                'amount': str(r.amount),
                'transaction_type': r.transaction_type,
                'reference_number': r.reference_number,
                'remarks': r.remarks,
                'recorded_by': f"{r.recorded_by.firstname} {r.recorded_by.lastname}" if r.recorded_by else None,
                'recorded_at': r.recorded_at.isoformat(),
            }
            for r in records
        ])

    def post(self, request, pk):
        data = request.data
        try:
            record = SavingsCapitalService.add_savings(
                member_id=pk,
                amount=data['amount'],
                transaction_type=data.get('transaction_type', 'deposit'),
                reference_number=data.get('reference_number', ''),
                remarks=data.get('remarks', ''),
                recorded_by=request.user,
            )
        except Member.DoesNotExist:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': 'Savings record added.',
            'id': record.id,
            'amount': str(record.amount),
        }, status=status.HTTP_201_CREATED)


class MemberCapitalView(AMOBaseView):
    def get(self, request, pk):
        records = SavingsCapitalService.get_member_capital(pk)
        return Response([
            {
                'id': r.id,
                'amount': str(r.amount),
                'transaction_type': r.transaction_type,
                'reference_number': r.reference_number,
                'remarks': r.remarks,
                'recorded_by': f"{r.recorded_by.firstname} {r.recorded_by.lastname}" if r.recorded_by else None,
                'recorded_at': r.recorded_at.isoformat(),
            }
            for r in records
        ])

    def post(self, request, pk):
        data = request.data
        try:
            record = SavingsCapitalService.add_capital(
                member_id=pk,
                amount=data['amount'],
                transaction_type=data.get('transaction_type', 'contribution'),
                reference_number=data.get('reference_number', ''),
                remarks=data.get('remarks', ''),
                recorded_by=request.user,
            )
        except Member.DoesNotExist:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'message': 'Capital record added.',
            'id': record.id,
            'amount': str(record.amount),
        }, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

class ReportsView(AMOBaseView):
    def get(self, request):
        return Response({
            'registration_summary': ReportService.get_registration_summary(),
            'savings_capital_summary': ReportService.get_savings_capital_summary(),
        })


# ---------------------------------------------------------------------------
# Activity Logs
# ---------------------------------------------------------------------------

class ActivityLogsView(AMOBaseView):
    def get(self, request):
        search = request.query_params.get('search', '')
        logs = ActivityLogService.get_logs(search=search)
        return Response([
            {
                'id': log.id,
                'user': f"{log.user.firstname} {log.user.lastname}" if log.user else 'System',
                'action': log.action,
                'action_type': log.action_type,
                'timestamp': log.timestamp.isoformat(),
                'success': log.success,
            }
            for log in logs
        ])


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class NotificationListView(AMOBaseView):
    def get(self, request):
        notifs = NotificationService.get_notifications(request.user)
        return Response([
            {
                'id': n.id,
                'title': n.title,
                'message': n.message,
                'notification_type': n.notification_type,
                'is_read': n.is_read,
                'created_at': n.created_at.isoformat(),
            }
            for n in notifs
        ])


class MarkNotificationReadView(AMOBaseView):
    def post(self, request, pk):
        try:
            NotificationService.mark_read(pk, request.user)
        except Exception:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response({'message': 'Marked as read.'})


class MarkAllNotificationsReadView(AMOBaseView):
    def post(self, request):
        NotificationService.mark_all_read(request.user)
        return Response({'message': 'All notifications marked as read.'})


class UnreadNotificationCountView(AMOBaseView):
    def get(self, request):
        count = NotificationService.get_unread_count(request.user)
        return Response({'unread_count': count})


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class ProfileView(AMOBaseView):
    def get(self, request):
        user = request.user
        profile_picture_url = None
        if user.profile_picture:
            profile_picture_url = request.build_absolute_uri(user.profile_picture.url)
        return Response({
            'id': user.id,
            'firstname': user.firstname,
            'lastname': user.lastname,
            'email': user.email,
            'employee_id': user.employee_id,
            'role': user.role.name if user.role else None,
            'status': user.status,
            'profile_picture': profile_picture_url,
        })

    def put(self, request):
        user = request.user
        user.firstname = request.data.get('firstname', user.firstname)
        user.lastname = request.data.get('lastname', user.lastname)
        user.save(update_fields=['firstname', 'lastname'])
        return Response({'message': 'Profile updated.'})


class ChangePasswordView(AMOBaseView):
    def post(self, request):
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')

        if not user.check_password(current_password):
            return Response({'error': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        if not new_password or len(new_password) < 8:
            return Response({'error': 'New password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password changed successfully.'})