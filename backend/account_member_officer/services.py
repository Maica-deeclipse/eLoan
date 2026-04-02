"""
Account Member Officer Business Logic Services
"""

from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from users.models import User, Applicant
from applicant.models import Savings, SharedCapital, MembershipApprovalLog, MembershipAppeal
from loans.models import AuditLog
from .models import AMONotification


class MemberApplicationService:
    """Handles pending applicant registration actions."""

    @staticmethod
    def get_pending_applicants():
        return Applicant.objects.filter(
            account_status='pending',
        ).order_by('-date_joined')

    @staticmethod
    def get_all_applicants():
        return Applicant.objects.order_by('-date_joined')

    @staticmethod
    def approve(user_id, performed_by, ip_address=None):
        from datetime import date
        applicant = Applicant.objects.get(pk=user_id)
        applicant.account_status = 'approved'
        applicant.approved_by = performed_by
        applicant.approved_at = timezone.now()
        if applicant.member_since is None:
            applicant.member_since = date.today()
        applicant.save()

        MembershipApprovalLog.objects.create(
            user=applicant,
            action='approved',
            performed_by=performed_by,
            ip_address=ip_address,
        )
        return applicant

    @staticmethod
    def reject(user_id, performed_by, reason='', ip_address=None):
        applicant = Applicant.objects.get(pk=user_id)
        applicant.account_status = 'rejected'
        applicant.rejection_reason = reason
        applicant.save()

        MembershipApprovalLog.objects.create(
            user=applicant,
            action='rejected',
            performed_by=performed_by,
            rejection_reason=reason,
            ip_address=ip_address,
        )
        return applicant


class MemberService:
    """Handles approved member management."""

    @staticmethod
    def get_all_members(search=None):
        qs = Applicant.objects.order_by('-member_since')
        if search:
            qs = qs.filter(
                Q(firstname__icontains=search) |
                Q(lastname__icontains=search) |
                Q(email__icontains=search)
            )
        return qs

    @staticmethod
    def get_member(member_id):
        return Applicant.objects.get(pk=member_id)

    @staticmethod
    def set_user_status(user_id, new_status):
        user = User.objects.get(pk=user_id)
        user.status = new_status
        user.save(update_fields=['status'])
        return user

    @staticmethod
    def set_employment_status(member_id, employment_status, performed_by):
        """AMO verifies and sets the employment status after reviewing COE documents."""
        applicant = Applicant.objects.get(pk=member_id)
        applicant.verified_employment_status = employment_status
        applicant.employment_status_verified_at = timezone.now()
        applicant.employment_status_verified_by = performed_by
        applicant.save(update_fields=[
            'verified_employment_status',
            'employment_status_verified_at',
            'employment_status_verified_by',
            'profile_updated_at',
        ])
        applicant.update_membership_classification()
        return applicant

    @staticmethod
    def set_fixed_deposit(member_id, fixed_deposit_amount, performed_by):
        """AMO enters the fixed deposit amount for a member."""
        from decimal import Decimal
        applicant = Applicant.objects.get(pk=member_id)
        applicant.fixed_deposit = Decimal(str(fixed_deposit_amount))
        applicant.save(update_fields=['fixed_deposit', 'profile_updated_at'])
        applicant.update_membership_classification()
        return applicant

    @staticmethod
    def set_shares(member_id, subscribed_shares, paid_shares):
        """
        AMO records share subscription for a member (By-Laws Section 3c & 6).

        Validates:
        - subscribed_shares >= 20
        - paid_shares >= 5
        - paid_shares <= subscribed_shares
        - member will not exceed 10% of total cooperative subscribed share capital
        """
        from django.core.exceptions import ValidationError as DjangoValidationError
        applicant = Applicant.objects.get(pk=member_id)
        applicant.subscribed_shares = subscribed_shares
        applicant.paid_shares = paid_shares
        try:
            applicant.full_clean(validate_unique=False)
        except DjangoValidationError as exc:
            messages = []
            for errs in exc.message_dict.values():
                messages.extend(errs)
            raise ValueError(' '.join(messages))
        applicant.save(update_fields=['subscribed_shares', 'paid_shares', 'profile_updated_at'])
        return applicant

    @staticmethod
    def get_pending_with_deadline():
        """Return pending applications with days remaining for 30-day decision rule."""
        from datetime import date, timedelta
        deadline_days = 30
        applicants = Applicant.objects.filter(
            account_status='pending',
        ).order_by('date_joined')

        result = []
        today = date.today()
        for u in applicants:
            days_since = (today - u.date_joined.date()).days
            days_remaining = deadline_days - days_since
            result.append({
                'user': u,
                'days_since_applied': days_since,
                'days_remaining': max(0, days_remaining),
                'deadline_reached': days_remaining <= 0,
                'deadline_date': (u.date_joined.date() + timedelta(days=deadline_days)).isoformat(),
            })
        return result


class AppealService:
    """Handles membership appeal workflow."""

    @staticmethod
    def get_pending_appeals():
        return MembershipAppeal.objects.filter(status='pending').select_related('user').order_by('-submitted_at')

    @staticmethod
    def get_all_appeals():
        return MembershipAppeal.objects.select_related('user', 'reviewed_by').order_by('-submitted_at')

    @staticmethod
    def submit_appeal(user_id, reason):
        """Applicant submits appeal after rejection."""
        user = User.objects.get(pk=user_id, role__name='Applicant', account_status='rejected')
        appeal, created = MembershipAppeal.objects.get_or_create(
            user=user,
            defaults={'reason': reason, 'status': 'pending'}
        )
        if not created:
            appeal.reason = reason
            appeal.status = 'pending'
            appeal.reviewed_by = None
            appeal.reviewed_at = None
            appeal.review_notes = None
            appeal.save()

        MembershipApprovalLog.objects.create(
            user=user,
            action='appeal_submitted',
            performed_by=user,
        )
        return appeal

    @staticmethod
    def approve_appeal(appeal_id, performed_by, notes='', ip_address=None):
        """AMO approves an appeal — re-activates the applicant's account."""
        appeal = MembershipAppeal.objects.select_related('user').get(pk=appeal_id)
        user = appeal.user

        appeal.status = 'approved'
        appeal.reviewed_by = performed_by
        appeal.reviewed_at = timezone.now()
        appeal.review_notes = notes
        appeal.save()

        from datetime import date
        # Re-approve the user account
        user.account_status = 'approved'
        user.approved_by = performed_by
        user.approved_at = timezone.now()
        user.rejection_reason = None
        if hasattr(user, 'applicant') and user.applicant.member_since is None:
            user.applicant.member_since = date.today()
            user.applicant.save(update_fields=['member_since'])
        user.save()

        MembershipApprovalLog.objects.create(
            user=user,
            action='appeal_approved',
            performed_by=performed_by,
            ip_address=ip_address,
        )
        return appeal

    @staticmethod
    def reject_appeal(appeal_id, performed_by, notes='', ip_address=None):
        """AMO rejects an appeal."""
        appeal = MembershipAppeal.objects.select_related('user').get(pk=appeal_id)
        appeal.status = 'rejected'
        appeal.reviewed_by = performed_by
        appeal.reviewed_at = timezone.now()
        appeal.review_notes = notes
        appeal.save()

        MembershipApprovalLog.objects.create(
            user=appeal.user,
            action='appeal_rejected',
            performed_by=performed_by,
            rejection_reason=notes,
            ip_address=ip_address,
        )
        return appeal


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
        member = Applicant.objects.get(pk=member_id)
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
        member = Applicant.objects.get(pk=member_id)
        if transaction_type == 'withdrawal':
            amount = -abs(Decimal(str(amount)))
        else:
            amount = abs(Decimal(str(amount)))
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
        pending = Applicant.objects.filter(account_status='pending').count()
        total_members = Applicant.objects.filter(account_status='approved').count()
        recent_approved = Applicant.objects.filter(
            account_status='approved',
            approved_at__gte=timezone.now() - timedelta(days=7),
        ).count()
        return {
            'pending_applications': pending,
            'total_members': total_members,
            'recently_approved': recent_approved,
        }

    @staticmethod
    def get_recent_applicants(limit=5):
        return Applicant.objects.filter(
            account_status='pending',
        ).order_by('-date_joined')[:limit]

    @staticmethod
    def get_recent_members(limit=5):
        return Applicant.objects.order_by('-member_since')[:limit]


class ActivityLogService:
    """Fetches audit log entries relevant to AMO work.

    RBAC: Security-related action types (face verification failures, liveness
    failures, suspicious activity) are excluded — those are superadmin-only.
    """

    # Action types reserved for Super Administrator visibility
    SUPERADMIN_ONLY_TYPES = {
        'FACE_VERIFY_FAIL',
        'LIVENESS_FAIL',
        'SUSPICIOUS_ACTIVITY',
        'RATE_LIMIT_HIT',
    }

    @staticmethod
    def get_logs(search=None, limit=100):
        qs = AuditLog.objects.select_related('user', 'related_application').order_by('-timestamp')
        qs = qs.exclude(action_type__in=ActivityLogService.SUPERADMIN_ONLY_TYPES)
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
            'pending': Applicant.objects.filter(account_status='pending').count(),
            'approved': Applicant.objects.filter(account_status='approved').count(),
            'rejected': Applicant.objects.filter(account_status='rejected').count(),
            'total': Applicant.objects.count(),
        }

    @staticmethod
    def get_savings_capital_summary():
        savings_total = Savings.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        capital_total = SharedCapital.objects.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        total_members = Applicant.objects.filter(account_status='approved').count()
        return {
            'total_savings': str(savings_total),
            'total_capital': str(capital_total),
            'total_members': total_members,
            'regular_members': Applicant.objects.filter(membership_type='regular').count(),
            'associate_members': Applicant.objects.filter(membership_type='associate').count(),
        }


class NotificationService:
    """Handles AMO notifications."""

    @staticmethod
    def get_notifications(user):
        return AMONotification.objects.filter(user=user, is_deleted=False, is_archived=False)

    @staticmethod
    def get_unread_count(user):
        return AMONotification.objects.filter(user=user, is_read=False, is_deleted=False, is_archived=False).count()

    @staticmethod
    def mark_read(notification_id, user):
        notif = AMONotification.objects.get(pk=notification_id, user=user)
        notif.mark_as_read()
        return notif

    @staticmethod
    def mark_all_read(user):
        AMONotification.objects.filter(user=user, is_read=False, is_deleted=False, is_archived=False).update(
            is_read=True, read_at=timezone.now()
        )

    @staticmethod
    def delete_notification(notification_id, user):
        try:
            n = AMONotification.objects.get(pk=notification_id, user=user)
            n.is_deleted = True
            n.save(update_fields=['is_deleted'])
            return True
        except AMONotification.DoesNotExist:
            return False

    @staticmethod
    def archive_notification(notification_id, user):
        try:
            n = AMONotification.objects.get(pk=notification_id, user=user)
            n.is_archived = True
            n.save(update_fields=['is_archived'])
            return True
        except AMONotification.DoesNotExist:
            return False