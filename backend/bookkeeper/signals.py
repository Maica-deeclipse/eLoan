"""
Bookkeeper Module Signals

Design Decision:
- Django signals for decoupled event handling
- Automatic notification creation when applications are submitted
- Keeps business logic out of models
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from loans.models import LoanApplication
from .services import NotificationService


@receiver(post_save, sender=LoanApplication)
def notify_bookkeepers_on_new_application(sender, instance, created, **kwargs):
    """
    Automatically notify all bookkeepers when a new application is submitted.

    Design Decision:
    - Uses post_save signal to catch all new applications
    - Only triggers for newly created applications
    - Checks if status is 'Submitted' to avoid false notifications
    """
    if created:
        # Check if the application status is 'Submitted'
        if instance.current_status and instance.current_status.status_name == 'Submitted':
            NotificationService.notify_bookkeepers_new_application(instance)
