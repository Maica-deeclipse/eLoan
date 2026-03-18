"""
Account Member Officer Business Logic Services
"""

from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from users.models import User
from applicant.models import Member, Savings, SharedCapital, MembershipApprovalLog
from loans.models import AuditLog
from .models import AMONotification


class MemberApplicationService:
    """Handles pending applicant registration actions."""

    @staticmethod
    def get_pending_applicants():
        return User.objects.filter(
            account_status='pending',
            role__name='Applicant',
        ).select_related('role').order_by('-date_joined')

    @staticmethod
    def get_all_applicants():
        return User.objects.filter(
            role__name='Applicant',
        ).select_related('role').order_by('-date_joined')

    @staticmethod
    def approve(user_id, performed_by, ip_address=None):
        user = User.objects.get(pk=user_id, role__name='Applicant')
        user.account_status = 'approved'
        user.approved_by = performed_by
        user.approved_at = timezone.now()
        user.save()

        Member.objects.get_or_create(user=user)

        MembershipApprovalLog.objects.create(
            user=user,
            action='approved',
            performed_by=performed_by,
            ip_address=ip_address,
        )
        return user

    @staticmethod
    def reject(user_id, performed_by, reason='', ip_address=None):
        user = User.objects.get(pk=user_id, role__name='Applicant')
        user.account_status = 'rejected'
        user.rejection_reason = reason
        user.save()

        MembershipApprovalLog.objects.create(
            user=user,
            action='rejected',
            performed_by=performed_by,
            rejection_reason=reason,
            ip_address=ip_address,
        )
        return user


class MemberService:
    """Handles approved member management."""

    @staticmethod
    def get_all_members(search=None):
        qs = Member.objects.select_related('user').order_by('-member_since')
        if search:
            qs = qs.filter(
                Q(user__firstname__icontains=search) |
                Q(user__lastname__icontains=search) |
                Q(user__email__icontains=search) |
                Q(user__employee_id__icontains=search)
            )
        return qs

    @staticmethod
    def get_member(member_id):
        return Member.objects.select_related('user').get(pk=member_id)

    @staticmethod
    def set_user_status(user_id, new_status):
        user = User.objects.get(pk=user_id)
        user.status = new_status
        user.save(update_fields=['status'])
        return user


class SavingsCapitalService:
    """Handles savings and shared capital transactions."""

    @staticmethod
    def get_member_savings(member_id):
        return Savings.objects.filter(member_id=member_id).select_related('recorded_by').order_by('-recorded_at')

    @staticmethod
    def get_member_capital(member_id):
        return SharedCapital.objects.filter(member_id=member_id).select_related('recorded_by').order_by('-recorded_at')

    @staticmethod
    def add_savings(member_id, amount, transaction_type, reference_number, remarks, recorded_by):
        member = Member.objects.get(pk=member_id)
        if transaction_type == 'withdrawal':
            amount = -abs(Decimal(str(amount)))
        else:
            amount = abs(Decimal(str(amount)))
        return Savings.objects.create(
            member=member,
            amount=amount,
            transaction_type=transaction_type,
            reference_number=reference_number,
            remarks=remarks,
            recorded_by=recorded_by,
        )

    @staticmethod
    def add_capital(member_id, amount, transaction_type, reference_number, remarks, recorded_by):
        member = Member.objects.get(pk=member_id)
        return SharedCapital.objects.create(
            member=member,
            amount=amount,
            transaction_type=transaction_type,
            reference_number=reference_number,
            remarks=remarks,
            recorded_by=recorded_by,
        )


class DashboardService:
    """Dashboard statistics for AMO."""

    @staticmethod
    def get_stats():
        pending = User.objects.filter(account_status='pending', role__name='Applicant').count()
        total_members = Member.objects.count()
        recent_approved = User.objects.filter(
            account_status='approved',
            role__name='Applicant',
            approved_at__gte=timezone.now() - timedelta(days=7),
        ).count()
        return {
            'pending_applications': pending,
            'total_members': total_members,
            'recently_approved': recent_approved,
        }

    @staticmethod
    def get_recent_applicants(limit=5):
        return User.objects.filter(
            account_status='pending',
            role__name='Applicant',
        ).order_by('-date_joined')[:limit]

    @staticmethod
    def get_recent_members(limit=5):
        return Member.objects.select_related('user').order_by('-member_since')[:limit]


class ActivityLogService:
    """Fetches audit log entries relevant to AMO work."""

    @staticmethod
    def get_logs(search=None, limit=100):
        qs = AuditLog.objects.select_related('user', 'related_application').order_by('-timestamp')
        if search:
            qs = qs.filter(
                Q(user__firstname__icontains=search) |
                Q(user__lastname__icontains=search) |
                Q(action__icontains=search)
            )
        return qs[:limit]


class ReportService:
    """Reports for AMO."""

    @staticmethod
    def get_registration_summary():
        return {
            'pending': User.objects.filter(account_status='pending', role__name='Applicant').count(),
            'approved': User.objects.filter(account_status='approved', role__name='Applicant').count(),
            'rejected': User.objects.filter(account_status='rejected', role__name='Applicant').count(),
            'total': User.objects.filter(role__name='Applicant').count(),
        }

    @staticmethod
    def get_savings_capital_summary():
        savings_total = Savings.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        capital_total = SharedCapital.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return {
            'total_savings': str(savings_total),
            'total_capital': str(capital_total),
            'total_members': Member.objects.count(),
            'regular_members': Member.objects.filter(membership_type='regular').count(),
            'associate_members': Member.objects.filter(membership_type='associate').count(),
        }


class NotificationService:
    """Handles AMO notifications."""

    @staticmethod
    def get_notifications(user):
        return AMONotification.objects.filter(user=user)

    @staticmethod
    def get_unread_count(user):
        return AMONotification.objects.filter(user=user, is_read=False).count()

    @staticmethod
    def mark_read(notification_id, user):
        notif = AMONotification.objects.get(pk=notification_id, user=user)
        notif.mark_as_read()
        return notif

    @staticmethod
    def mark_all_read(user):
        AMONotification.objects.filter(user=user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )