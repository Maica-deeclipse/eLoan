"""
Credit Committee Business Logic Services

Design Decision:
- Separation of Concerns: Business logic is isolated from views
- Testability: Services can be unit tested independently
- Reusability: Same logic can be used by views, APIs, or management commands
- Single Responsibility: Each service handles one domain concern

Services:
1. CreditCommitteeApplicationService: Get pending applications
2. DecisionService: Submit decisions, update status, create audit record
3. CreditCommitteeDashboardService: Dashboard statistics
4. CreditCommitteeReportService: Generate reports
5. CreditCommitteeNotificationService: Notification handling
"""

from django.db.models import Count, Avg, Q, F
from django.db.models.functions import TruncMonth, TruncDate
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from loans.models import LoanApplication, ApplicationStatus
from bookkeeper.models import Notification
from .models import CreditCommitteeDecision


class CreditCommitteeApplicationService:
    """Service for managing applications in Credit Committee context."""

    # Status names used in the workflow
    STATUS_PENDING_CC = 'Pending Credit Committee'
    STATUS_APPROVED = 'Approved by Credit Committee'
    STATUS_REJECTED = 'Rejected by Credit Committee'
    STATUS_RETURNED = 'Returned to Treasurer'

    @staticmethod
    def get_pending_applications():
        """
        Get all applications pending Credit Committee decision.

        Returns:
            QuerySet: Applications with status 'Pending Credit Committee'
        """
        return LoanApplication.objects.filter(
            current_status__status_name=CreditCommitteeApplicationService.STATUS_PENDING_CC
        ).select_related(
            'user', 'loan_type', 'current_status'
        ).prefetch_related(
            'treasurer_evaluations', 'bookkeeper_verifications'
        ).order_by('-application_date')

    @staticmethod
    def get_application_by_id(application_id):
        """
        Get single application with all related data for review.

        Args:
            application_id: ID of the application

        Returns:
            LoanApplication: Application object or None
        """
        try:
            return LoanApplication.objects.select_related(
                'user', 'loan_type', 'current_status'
            ).prefetch_related(
                'documents',
                'comakers',
                'bookkeeper_verifications',
                'treasurer_evaluations',
                'credit_committee_decisions'
            ).get(pk=application_id)
        except LoanApplication.DoesNotExist:
            return None


class DecisionService:
    """Service for Credit Committee decisions."""

    # Number of CC member approvals required to fully approve an application
    REQUIRED_APPROVALS = 1

    @staticmethod
    def get_current_round_since(application):
        """
        Return the datetime when the application last entered 'Pending Credit Committee'
        status, used to scope decisions to the current review round.
        """
        from loans.models import StatusChangeLog
        log = StatusChangeLog.objects.filter(
            application=application,
            to_status__status_name='Pending Credit Committee',
        ).order_by('-changed_at').first()
        if log:
            return log.changed_at
        return application.application_date

    @staticmethod
    def has_member_decided(application, committee_member):
        """Return True if the member already voted in the current review round."""
        since = DecisionService.get_current_round_since(application)
        return CreditCommitteeDecision.objects.filter(
            application=application,
            decided_by=committee_member,
            decided_at__gte=since,
        ).exists()

    @staticmethod
    def get_current_round_approvals(application):
        """Return QS of approved decisions in the current review round."""
        since = DecisionService.get_current_round_since(application)
        return CreditCommitteeDecision.objects.filter(
            application=application,
            decision='approved',
            decided_at__gte=since,
        ).select_related('decided_by')

    @staticmethod
    def submit_decision(application, committee_member, decision, remarks, meeting_date, rejection_category=None, ip_address=None):
        """
        Submit a Credit Committee decision.

        For 'approved': records the vote and checks approval count.
          - Status stays 'Pending Credit Committee' until REQUIRED_APPROVALS approvals
            are collected, then advances to 'Approved – For Disbursement'.
        For 'rejected' / 'returned': immediately changes status (as before).

        Returns:
            tuple: (CreditCommitteeDecision, approval_count)
              approval_count is the total approvals so far (only meaningful for
              'approved' decisions; 0 for others).
        """
        from django.db import transaction

        # Guard: prevent duplicate votes in the same round
        if DecisionService.has_member_decided(application, committee_member):
            raise ValueError('You have already submitted a decision for this application in the current review round.')

        if decision == 'approved':
            with transaction.atomic():
                cc_decision = CreditCommitteeDecision.objects.create(
                    application=application,
                    decided_by=committee_member,
                    decision=decision,
                    remarks=remarks,
                    meeting_date=meeting_date,
                    ip_address=ip_address,
                )

                approval_count = DecisionService.get_current_round_approvals(application).count()

                if approval_count >= DecisionService.REQUIRED_APPROVALS:
                    # All required approvals received — advance status
                    new_status, _ = ApplicationStatus.objects.get_or_create(
                        status_name='Approved – For Disbursement'
                    )
                    application.current_status = new_status
                    from django.utils import timezone as _tz
                    application.approved_at = _tz.now()
                    application.save(update_fields=['current_status', 'approved_at'])

                    CreditCommitteeNotificationService.notify_full_approval(
                        application, committee_member, remarks
                    )
                else:
                    # Partial approval — keep status, notify about progress
                    CreditCommitteeNotificationService.notify_partial_approval(
                        application, committee_member, approval_count, DecisionService.REQUIRED_APPROVALS
                    )

                return cc_decision, approval_count

        else:
            # 'rejected' or 'returned' — immediate status change
            status_map = {
                'rejected': CreditCommitteeApplicationService.STATUS_REJECTED,
                'returned': CreditCommitteeApplicationService.STATUS_RETURNED,
            }
            new_status, _ = ApplicationStatus.objects.get_or_create(
                status_name=status_map[decision]
            )
            application.current_status = new_status
            application.save(update_fields=['current_status'])

            cc_decision = CreditCommitteeDecision.objects.create(
                application=application,
                decided_by=committee_member,
                decision=decision,
                remarks=remarks,
                rejection_category=rejection_category,
                meeting_date=meeting_date,
                ip_address=ip_address,
            )

            CreditCommitteeNotificationService.notify_decision(
                application, committee_member, decision, remarks
            )

            return cc_decision, 0

    @staticmethod
    def get_decision_history(filters=None):
        """
        Get all Credit Committee decisions with optional filters.

        Args:
            filters: dict with optional keys: start_date, end_date, decision

        Returns:
            QuerySet: CreditCommitteeDecision records
        """
        queryset = CreditCommitteeDecision.objects.select_related(
            'application__user', 'application__loan_type', 'decided_by'
        ).order_by('-decided_at')

        if filters:
            if filters.get('start_date'):
                queryset = queryset.filter(decided_at__date__gte=filters['start_date'])
            if filters.get('end_date'):
                queryset = queryset.filter(decided_at__date__lte=filters['end_date'])
            if filters.get('decision'):
                queryset = queryset.filter(decision=filters['decision'])

        return queryset


class CreditCommitteeDashboardService:
    """Service for dashboard statistics."""

    @staticmethod
    def get_dashboard_stats():
        """
        Get all dashboard statistics for Credit Committee.

        Returns:
            dict: Dashboard statistics
        """
        today = timezone.now().date()
        start_of_month = today.replace(day=1)

        # Pending applications count
        pending_status = ApplicationStatus.objects.filter(
            status_name='Pending Credit Committee'
        ).first()

        pending_count = LoanApplication.objects.filter(
            current_status=pending_status
        ).count() if pending_status else 0

        # This month's decisions
        month_decisions = CreditCommitteeDecision.objects.filter(
            decided_at__date__gte=start_of_month
        )

        approved_this_month = month_decisions.filter(decision='approved').count()
        rejected_this_month = month_decisions.filter(decision='rejected').count()
        returned_this_month = month_decisions.filter(decision='returned').count()

        # Average decision time (days from application submission to CC decision)
        avg_decision_time = CreditCommitteeDashboardService.calculate_avg_decision_time()

        return {
            'pending_count': pending_count,
            'approved_this_month': approved_this_month,
            'rejected_this_month': rejected_this_month,
            'returned_this_month': returned_this_month,
            'avg_decision_time': avg_decision_time,
        }

    @staticmethod
    def calculate_avg_decision_time():
        """
        Calculate average time from application submission to CC decision.

        Returns:
            float: Average days or None if no data
        """
        # Get decisions from last 30 days with application date
        thirty_days_ago = timezone.now() - timedelta(days=30)

        decisions = CreditCommitteeDecision.objects.filter(
            decided_at__gte=thirty_days_ago
        ).select_related('application')

        if not decisions.exists():
            return None

        total_days = 0
        count = 0

        for decision in decisions:
            if decision.application and decision.application.application_date:
                delta = decision.decided_at.date() - decision.application.application_date.date()
                total_days += delta.days
                count += 1

        return round(total_days / count, 1) if count > 0 else None

    @staticmethod
    def get_recent_applications(limit=5):
        """
        Get most recent pending applications.

        Args:
            limit: Number of applications to return

        Returns:
            QuerySet: Recent pending applications
        """
        return CreditCommitteeApplicationService.get_pending_applications()[:limit]

    @staticmethod
    def get_recent_decisions(limit=10):
        """
        Get recent Credit Committee decisions.

        Args:
            limit: Number of decisions to return

        Returns:
            QuerySet: Recent decisions
        """
        return CreditCommitteeDecision.objects.select_related(
            'application__user', 'application__loan_type', 'decided_by'
        ).order_by('-decided_at')[:limit]


class CreditCommitteeReportService:
    """Service for generating Credit Committee reports."""

    @staticmethod
    def get_approval_stats(days=30):
        """
        Get approval/rejection statistics for a period.

        Args:
            days: Number of days to include

        Returns:
            dict: Approval statistics
        """
        start_date = timezone.now() - timedelta(days=days)

        decisions = CreditCommitteeDecision.objects.filter(
            decided_at__gte=start_date
        )

        total = decisions.count()
        approved = decisions.filter(decision='approved').count()
        rejected = decisions.filter(decision='rejected').count()
        returned = decisions.filter(decision='returned').count()

        return {
            'total': total,
            'approved': approved,
            'rejected': rejected,
            'returned': returned,
            'approval_rate': round((approved / total * 100), 1) if total > 0 else 0,
            'rejection_rate': round((rejected / total * 100), 1) if total > 0 else 0,
        }

    @staticmethod
    def get_monthly_stats(months=6):
        """
        Get monthly decision statistics.

        Args:
            months: Number of months to include

        Returns:
            list: Monthly statistics
        """
        start_date = timezone.now() - timedelta(days=months * 30)

        return list(CreditCommitteeDecision.objects.filter(
            decided_at__gte=start_date
        ).annotate(
            month=TruncMonth('decided_at')
        ).values('month', 'decision').annotate(
            count=Count('id')
        ).order_by('month'))

    @staticmethod
    def get_decisions_by_loan_type():
        """
        Get decision distribution by loan type.

        Returns:
            list: Decision counts by loan type
        """
        return list(CreditCommitteeDecision.objects.values(
            'application__loan_type__loan_name', 'decision'
        ).annotate(count=Count('id')).order_by('-count'))

    @staticmethod
    def get_high_risk_approval_ratio():
        """
        Calculate ratio of high-risk approvals.
        High risk = DTI > 40% from treasurer evaluation.

        Returns:
            dict: High risk approval statistics
        """
        # Get approved applications
        approved_decisions = CreditCommitteeDecision.objects.filter(
            decision='approved'
        ).values_list('application_id', flat=True)

        total_approved = len(approved_decisions)

        if total_approved == 0:
            return {
                'high_risk_approved': 0,
                'total_approved': 0,
                'ratio': 0,
            }

        # Count high-risk (DTI > 40) among approved
        from treasurer.models import TreasurerEvaluation

        high_risk_count = TreasurerEvaluation.objects.filter(
            application_id__in=approved_decisions,
            dti_ratio__gt=40
        ).values('application_id').distinct().count()

        return {
            'high_risk_approved': high_risk_count,
            'total_approved': total_approved,
            'ratio': round((high_risk_count / total_approved * 100), 1) if total_approved > 0 else 0,
        }

    @staticmethod
    def get_committee_member_stats(days=30):
        """
        Get statistics per committee member.

        Args:
            days: Number of days to include

        Returns:
            list: Statistics per member
        """
        start_date = timezone.now() - timedelta(days=days)

        return list(CreditCommitteeDecision.objects.filter(
            decided_at__gte=start_date
        ).values(
            'decided_by__id',
            'decided_by__firstname',
            'decided_by__lastname'
        ).annotate(
            total_decisions=Count('id'),
            approvals=Count('id', filter=Q(decision='approved')),
            rejections=Count('id', filter=Q(decision='rejected')),
            returns=Count('id', filter=Q(decision='returned'))
        ).order_by('-total_decisions'))


class CreditCommitteeNotificationService:
    """Service for Credit Committee notifications."""

    @staticmethod
    def _get_all_staff_by_roles(role_names):
        """Helper: return all active users for the given role name(s)."""
        from users.models import User, Role
        roles = Role.objects.filter(name__in=role_names)
        return User.objects.filter(role__in=roles, is_active=True)

    @staticmethod
    def notify_partial_approval(application, approving_member, approval_count, required):
        """
        Notify all CC, Treasurer, and Bookkeeper members that a CC member has
        approved an application but the required threshold has not yet been reached.
        """
        from users.models import User, Role
        remaining = required - approval_count
        member_name = f"{application.user.firstname} {application.user.lastname}"
        approver_name = f"{approving_member.firstname} {approving_member.lastname}"

        recipients = CreditCommitteeNotificationService._get_all_staff_by_roles(
            ['Credit Committee', 'Treasurer', 'Bookkeeper']
        )
        for user in recipients:
            Notification.objects.create(
                user=user,
                title='CC Approval Progress Update',
                message=(
                    f'{approver_name} approved loan application #{application.id} '
                    f'for {member_name} ({application.loan_type.loan_name}). '
                    f'{approval_count}/{required} approvals received. '
                    f'{remaining} more approval{"s" if remaining > 1 else ""} needed.'
                ),
                notification_type='info',
                related_application=application,
            )

    @staticmethod
    def notify_full_approval(application, approving_member, remarks):
        """
        Notify all CC, Treasurer, Bookkeeper, AMO, and the applicant that the
        application has received all required CC approvals.
        """
        from users.models import User, Role
        member_name = f"{application.user.firstname} {application.user.lastname}"

        # Notify applicant
        Notification.objects.create(
            user=application.user,
            title='Loan Application Approved',
            message=(
                f'Your loan application for {application.loan_type.loan_name} '
                f'has been fully approved by the Credit Committee.'
            ),
            notification_type='approval',
            related_application=application,
        )

        # Notify Treasurer, Bookkeeper, Credit Committee
        staff_recipients = CreditCommitteeNotificationService._get_all_staff_by_roles(
            ['Treasurer', 'Bookkeeper', 'Credit Committee']
        )
        for user in staff_recipients:
            Notification.objects.create(
                user=user,
                title='Loan Fully Approved – CC Decision Complete',
                message=(
                    f'Loan application #{application.id} for {member_name} '
                    f'({application.loan_type.loan_name}, '
                    f'₱{application.amount_requested:,.2f}) has received all required '
                    f'Credit Committee approvals and is now approved for disbursement.'
                ),
                notification_type='approval',
                related_application=application,
            )

        # Notify AMO
        try:
            from account_member_officer.models import AMONotification
            amo_role = Role.objects.get(name='Account Member Officer')
            amo_users = User.objects.filter(role=amo_role, is_active=True)
            for amo in amo_users:
                AMONotification.objects.create(
                    user=amo,
                    title='Loan Fully Approved – Action Required',
                    message=(
                        f'Loan application #{application.id} for {member_name} '
                        f'has been fully approved by the Credit Committee. '
                        f'Please coordinate with the Treasurer for fund release.'
                    ),
                    notification_type='action_required',
                )
        except Role.DoesNotExist:
            pass

    @staticmethod
    def notify_decision(application, committee_member, decision, remarks):
        """
        Notify relevant parties about a rejection or return-to-treasurer decision.
        (Full approval notifications are handled by notify_full_approval.)
        """
        from users.models import User, Role

        decision_text = {
            'rejected': 'rejected',
            'returned': 'returned to the Treasurer for further review',
        }

        notification_type_map = {
            'rejected': 'rejection',
            'returned': 'status_change',
        }

        # Notify applicant
        Notification.objects.create(
            user=application.user,
            title='Loan Application Decision',
            message=(
                f'Your loan application for {application.loan_type.loan_name} '
                f'has been {decision_text[decision]} by the Credit Committee.'
            ),
            notification_type=notification_type_map[decision],
            related_application=application,
        )

        # Notify CC, Treasurer, Bookkeeper about the decision
        staff_recipients = CreditCommitteeNotificationService._get_all_staff_by_roles(
            ['Treasurer', 'Bookkeeper', 'Credit Committee']
        )
        member_name = f"{application.user.firstname} {application.user.lastname}"
        decider_name = f"{committee_member.firstname} {committee_member.lastname}"

        for user in staff_recipients:
            Notification.objects.create(
                user=user,
                title=f'Application {"Rejected" if decision == "rejected" else "Returned to Treasurer"}',
                message=(
                    f'{decider_name} has {decision_text[decision]} application #{application.id} '
                    f'for {member_name} ({application.loan_type.loan_name}). '
                    f'Reason: {remarks}'
                ),
                notification_type=notification_type_map[decision],
                related_application=application,
            )

    @staticmethod
    def get_notifications(user, limit=50):
        """
        Get notifications for a user.

        Args:
            user: User instance
            limit: Maximum number of notifications

        Returns:
            QuerySet: Notification records
        """
        return Notification.objects.filter(
            user=user, is_deleted=False, is_archived=False
        ).select_related('related_application').order_by('-created_at')[:limit]

    @staticmethod
    def get_unread_count(user):
        return Notification.objects.filter(user=user, is_read=False, is_deleted=False, is_archived=False).count()

    @staticmethod
    def mark_as_read(notification_id, user):
        try:
            notification = Notification.objects.get(pk=notification_id, user=user)
            notification.mark_as_read()
            return True
        except Notification.DoesNotExist:
            return False

    @staticmethod
    def mark_all_as_read(user):
        return Notification.objects.filter(
            user=user, is_read=False, is_deleted=False, is_archived=False
        ).update(is_read=True, read_at=timezone.now())

    @staticmethod
    def delete_notification(notification_id, user):
        try:
            n = Notification.objects.get(pk=notification_id, user=user)
            n.is_deleted = True
            n.save(update_fields=['is_deleted'])
            return True
        except Notification.DoesNotExist:
            return False

    @staticmethod
    def archive_notification(notification_id, user):
        try:
            n = Notification.objects.get(pk=notification_id, user=user)
            n.is_archived = True
            n.save(update_fields=['is_archived'])
            return True
        except Notification.DoesNotExist:
            return False
