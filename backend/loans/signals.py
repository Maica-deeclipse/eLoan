"""
Loan Application Signals

Auto-logs status changes for loan applications using Django signals.
This provides a clean architecture by separating logging logic from views/services.

Usage:
    Status changes are automatically logged when LoanApplication.current_status is modified.
    To include user info and remarks, set these attributes before saving:
        application._status_changed_by = user
        application._status_change_remarks = "Reason for change"
"""

from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.utils import timezone


@receiver(pre_save, sender='loans.LoanApplication')
def capture_previous_status(sender, instance, **kwargs):
    """
    Capture the previous status before saving.
    This is needed to log the 'from_status' in the StatusChangeLog.
    """
    if instance.pk:
        try:
            # Get the current state from database
            from loans.models import LoanApplication
            old_instance = LoanApplication.objects.get(pk=instance.pk)
            instance._previous_status = old_instance.current_status
        except LoanApplication.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender='loans.LoanApplication')
def log_status_change(sender, instance, created, **kwargs):
    """
    Log status changes to StatusChangeLog after saving.

    Attributes that can be set on the instance before saving:
        _status_changed_by: User who made the change
        _status_change_remarks: Reason/remarks for the change
    """
    from loans.models import StatusChangeLog

    # Get the previous status (captured in pre_save)
    previous_status = getattr(instance, '_previous_status', None)
    current_status = instance.current_status

    # Only log if status actually changed
    if previous_status != current_status:
        # Get user who made the change (if set)
        changed_by = getattr(instance, '_status_changed_by', None)

        # Get role name
        changed_by_role = None
        if changed_by and hasattr(changed_by, 'role') and changed_by.role:
            changed_by_role = changed_by.role.name

        # Get remarks (if set)
        remarks = getattr(instance, '_status_change_remarks', None)

        # Create the log entry
        StatusChangeLog.objects.create(
            application=instance,
            changed_by=changed_by,
            changed_by_role=changed_by_role,
            from_status=previous_status,
            to_status=current_status,
            changed_at=timezone.now(),
            remarks=remarks
        )

        # Clean up temporary attributes
        if hasattr(instance, '_previous_status'):
            del instance._previous_status
        if hasattr(instance, '_status_changed_by'):
            del instance._status_changed_by
        if hasattr(instance, '_status_change_remarks'):
            del instance._status_change_remarks
