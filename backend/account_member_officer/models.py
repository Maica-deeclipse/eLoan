"""
Account Member Officer Module Models
"""

from django.db import models
from django.conf import settings
from django.utils import timezone


class AMONotification(models.Model):
    NOTIFICATION_TYPES = [
        ('new_registration', 'New Registration'),
        ('approval', 'Approval'),
        ('rejection', 'Rejection'),
        ('savings_update', 'Savings Update'),
        ('capital_update', 'Capital Update'),
        ('action_required', 'Action Required'),
        ('info', 'Information'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='amo_notifications',
    )
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(
        max_length=20,
        choices=NOTIFICATION_TYPES,
        default='info',
    )
    is_read = models.BooleanField(default=False)
    is_archived = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'AMO Notification'
        verbose_name_plural = 'AMO Notifications'
        indexes = [
            models.Index(fields=['user', 'is_read']),
        ]

    def __str__(self):
        return f"{self.title} - {self.user.email}"

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])
