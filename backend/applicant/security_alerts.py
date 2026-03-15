"""
Security Alert Service for Identity Verification Failures

Monitors and alerts administrators about suspicious patterns:
- Multiple failed face verification attempts
- Multiple failed liveness checks
- Potential fraud or spoofing attempts

Automatically creates notifications for:
- Super Administrators
- Bookkeepers
- Credit Committee members (if configured)

Logs all alerts to AuditLog for forensic analysis.
"""

import logging
from django.utils import timezone
from datetime import timedelta
from django.conf import settings

logger = logging.getLogger('security_alerts')


class SecurityAlertService:
    """
    Service for detecting and alerting on suspicious verification patterns.

    Monitors failed verification attempts and sends alerts when thresholds
    are exceeded, helping detect potential fraud or spoofing attacks.
    """

    @classmethod
    def get_failure_threshold(cls):
        """Get failure threshold from settings (lazy evaluation)."""
        return getattr(settings, 'SECURITY_ALERT_THRESHOLD', 3)

    @classmethod
    def get_time_window(cls):
        """Get time window from settings (lazy evaluation)."""
        hours = getattr(settings, 'SECURITY_ALERT_WINDOW_HOURS', 1)
        return timedelta(hours=hours)

    @classmethod
    def check_and_alert_repeated_failures(cls, user, application, failure_type):
        """
        Check if user has exceeded failure threshold and create alert.

        Analyzes recent failure history and triggers notifications to
        administrative staff if suspicious activity is detected.

        Args:
            user: User object who attempted verification
            application: LoanApplication object being verified
            failure_type: Type of failure ('FACE_VERIFY_FAIL' or 'LIVENESS_FAIL')

        Returns:
            bool: True if alert was triggered, False otherwise
        """
        try:
            from loans.models import AuditLog

            # Get thresholds
            failure_threshold = cls.get_failure_threshold()
            time_window = cls.get_time_window()

            # Count recent failures for this user
            since = timezone.now() - time_window
            recent_failures = AuditLog.objects.filter(
                user=user,
                action_type=failure_type,
                success=False,
                timestamp__gte=since
            ).count()

            logger.info(f"User {user.id} has {recent_failures} {failure_type} failures in last {time_window}")

            # If threshold exceeded, create alert
            if recent_failures >= failure_threshold:
                logger.warning(f"ALERT: User {user.id} exceeded failure threshold ({recent_failures} >= {failure_threshold})")
                cls._create_security_alert(user, application, failure_type, recent_failures, time_window)
                return True

            return False

        except Exception as e:
            logger.error(f"Error in check_and_alert_repeated_failures: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return False

    @classmethod
    def _create_security_alert(cls, user, application, failure_type, count, time_window):
        """
        Create security alert notifications for administrators.

        Sends notifications to:
        - All Super Administrators
        - All Bookkeepers
        - Logs alert to AuditLog

        Args:
            user: User who triggered the alert
            application: Related loan application
            failure_type: Type of failure that triggered alert
            count: Number of failures detected
            time_window: Time window (timedelta) for the failures
        """
        try:
            from users.models import User
            from bookkeeper.models import Notification
            from loans.models import AuditLog

            # Get administrative users
            admin_users = User.objects.filter(role__name='Super Administrator')
            bookkeeper_users = User.objects.filter(role__name='Bookkeeper')

            # Prepare alert messages
            failure_name = failure_type.replace('_', ' ').title()
            alert_title = f"Security Alert: Suspicious Activity Detected"
            alert_message = cls._format_alert_message(user, application, failure_type, count, time_window)

            # Create notifications for admins
            notifications_created = 0
            for admin in admin_users:
                try:
                    Notification.objects.create(
                        user=admin,
                        title=alert_title,
                        message=alert_message,
                        notification_type='action_required',
                        related_application=application
                    )
                    notifications_created += 1
                except Exception as e:
                    logger.error(f"Failed to create notification for admin {admin.id}: {str(e)}")

            # Create notifications for bookkeepers
            for bookkeeper in bookkeeper_users:
                try:
                    Notification.objects.create(
                        user=bookkeeper,
                        title=alert_title,
                        message=alert_message,
                        notification_type='action_required',
                        related_application=application
                    )
                    notifications_created += 1
                except Exception as e:
                    logger.error(f"Failed to create notification for bookkeeper {bookkeeper.id}: {str(e)}")

            # Log the alert creation to AuditLog
            AuditLog.objects.create(
                user=user,
                action=f"Security alert triggered: {count} {failure_name} failures",
                action_type='SUSPICIOUS_ACTIVITY',
                severity='CRITICAL',
                success=False,
                failure_reason=f"{count} consecutive {failure_name} failures within {time_window}",
                related_application=application
            )

            logger.warning(f"Security alert created: {notifications_created} notifications sent for user {user.id}")

        except Exception as e:
            logger.error(f"Error creating security alert: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())

    @classmethod
    def _format_alert_message(cls, user, application, failure_type, count, time_window):
        """
        Format alert message with detailed information.

        Args:
            user: User who triggered alert
            application: Related loan application
            failure_type: Type of failure
            count: Number of failures
            time_window: Time window (timedelta) for the failures

        Returns:
            str: Formatted alert message
        """
        failure_descriptions = {
            'FACE_VERIFY_FAIL': 'face verification',
            'LIVENESS_FAIL': 'liveness check'
        }

        failure_desc = failure_descriptions.get(failure_type, failure_type.replace('_', ' ').lower())

        message = (
            f"⚠️ SUSPICIOUS ACTIVITY DETECTED\n\n"
            f"User: {user.get_full_name()} (ID: {user.id})\n"
            f"Email: {user.email}\n"
            f"Application: #{application.id}\n"
            f"Loan Amount: ₱{application.amount:,.2f}\n\n"
            f"ALERT REASON:\n"
            f"User has failed {failure_desc} {count} times within the last {cls._format_time_window(time_window)}.\n\n"
            f"This pattern may indicate:\n"
            f"• Identity fraud or spoofing attempts\n"
            f"• Use of fake/manipulated photos\n"
            f"• Automated bot attacks\n"
            f"• Account compromise\n\n"
            f"RECOMMENDED ACTIONS:\n"
            f"1. Review application #{application.id} immediately\n"
            f"2. Examine uploaded documents and photos\n"
            f"3. Contact user to verify identity via phone/video call\n"
            f"4. Consider flagging application for manual review\n"
            f"5. Check IP address and device information for anomalies\n\n"
            f"Please investigate this activity promptly."
        )

        return message

    @classmethod
    def _format_time_window(cls, time_window):
        """
        Format time window as human-readable string.

        Args:
            time_window: Time window (timedelta) to format

        Returns:
            str: Formatted time window (e.g., "1 hour", "2 hours")
        """
        hours = int(time_window.total_seconds() / 3600)
        if hours == 1:
            return "1 hour"
        else:
            return f"{hours} hours"

    @classmethod
    def get_failure_statistics(cls, user, days=7):
        """
        Get detailed failure statistics for a user.

        Useful for administrative review and pattern analysis.

        Args:
            user: User to analyze
            days: Number of days to look back (default: 7)

        Returns:
            dict: Statistics including failure counts by type, dates, etc.
        """
        try:
            from loans.models import AuditLog

            since = timezone.now() - timedelta(days=days)

            # Count failures by type
            face_failures = AuditLog.objects.filter(
                user=user,
                action_type='FACE_VERIFY_FAIL',
                timestamp__gte=since
            ).count()

            liveness_failures = AuditLog.objects.filter(
                user=user,
                action_type='LIVENESS_FAIL',
                timestamp__gte=since
            ).count()

            rate_limit_hits = AuditLog.objects.filter(
                user=user,
                action_type='RATE_LIMIT_HIT',
                timestamp__gte=since
            ).count()

            suspicious_activity = AuditLog.objects.filter(
                user=user,
                action_type='SUSPICIOUS_ACTIVITY',
                timestamp__gte=since
            ).count()

            failure_threshold = cls.get_failure_threshold()

            return {
                'user_id': user.id,
                'period_days': days,
                'face_verification_failures': face_failures,
                'liveness_check_failures': liveness_failures,
                'rate_limit_hits': rate_limit_hits,
                'suspicious_activity_alerts': suspicious_activity,
                'total_failures': face_failures + liveness_failures,
                'is_high_risk': (face_failures + liveness_failures) >= (failure_threshold * 2)
            }

        except Exception as e:
            logger.error(f"Error getting failure statistics: {str(e)}")
            return {
                'error': str(e)
            }
