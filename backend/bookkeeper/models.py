"""
Bookkeeper Module Models

Design Decisions:
1. Notification Model:
   - Generic notification system that can be used across all roles
   - Supports different notification types for filtering/styling
   - Tracks read status for badge counts
   - Uses soft timestamps for audit trails

2. BookkeeperVerification Model:
   - Tracks all bookkeeper actions on loan applications
   - Immutable audit trail (no updates, only inserts)
   - Required rejection_reason for rejected applications
   - Separation of Duties: Bookkeeper can only verify, not approve loans

3. Design Principles:
   - Single Responsibility: Each model handles one concern
   - Audit Trail: All actions are logged with timestamps
   - Data Integrity: Using ForeignKey with appropriate on_delete behavior
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from loans.models import LoanApplication


class Notification(models.Model):
    """
    System notification model for all user roles.

    Design Decision:
    - Generic model usable by all modules (Bookkeeper, Treasurer, etc.)
    - notification_type allows for different styling and filtering
    - related_application links to relevant loan for quick access
    - Ordered by creation date (newest first)

    Notification Types:
    - new_application: New loan application submitted
    - status_change: Application status changed
    - action_required: User needs to take action
    - info: General information
    """

    NOTIFICATION_TYPES = [
        ('new_application', 'New Application'),
        ('status_change', 'Status Change'),
        ('action_required', 'Action Required'),
        ('info', 'Information'),
        ('approval', 'Approval'),
        ('rejection', 'Rejection'),
        ('security_alert', 'Security Alert'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        help_text='User who receives this notification'
    )
    title = models.CharField(
        max_length=200,
        help_text='Short notification title'
    )
    message = models.TextField(
        help_text='Full notification message'
    )
    notification_type = models.CharField(
        max_length=20,
        choices=NOTIFICATION_TYPES,
        default='info',
        help_text='Type of notification for styling/filtering'
    )
    related_application = models.ForeignKey(
        LoanApplication,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications',
        help_text='Related loan application (if applicable)'
    )
    is_read = models.BooleanField(
        default=False,
        help_text='Whether user has read this notification'
    )
    is_archived = models.BooleanField(
        default=False,
        help_text='Whether user has archived this notification'
    )
    is_deleted = models.BooleanField(
        default=False,
        help_text='Soft delete — hidden from all views'
    )
    created_at = models.DateTimeField(
        default=timezone.now,
        help_text='When notification was created'
    )
    read_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text='When notification was marked as read'
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'
        indexes = [
            models.Index(fields=['user', 'is_read']),
            models.Index(fields=['user', 'created_at']),
        ]

    def __str__(self):
        return f"{self.title} - {self.user.email}"

    def mark_as_read(self):
        """Mark notification as read with timestamp."""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])


class BookkeeperVerification(models.Model):
    """
    Tracks bookkeeper verification actions on loan applications.

    Design Decision:
    - Immutable Record: Once created, should not be modified (audit trail)
    - Required Rejection Reason: Ensures accountability for rejections
    - Separation from LoanApplication: Keeps verification logic isolated
    - Enables tracking of verification history

    Workflow:
    1. Applicant submits application (status: 'Submitted')
    2. Bookkeeper reviews and verifies (status: 'Verified by Bookkeeper')
       OR rejects (status: 'Rejected by Bookkeeper')
    3. Verified applications move to Treasurer queue
    """

    ACTION_CHOICES = [
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ]

    REJECTION_CATEGORY_CHOICES = [
        ('incomplete_docs', 'Incomplete Documentation'),
        ('invalid_docs', 'Invalid/Expired Documents'),
        ('insufficient_savings', 'Insufficient Savings'),
        ('insufficient_income', 'Insufficient Income'),
        ('employment_not_verified', 'Employment Not Verified'),
        ('others', 'Others'),
    ]

    application = models.ForeignKey(
        LoanApplication,
        on_delete=models.CASCADE,
        related_name='bookkeeper_verifications',
        help_text='Loan application being verified'
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='bookkeeper_verifications',
        help_text='Bookkeeper who performed the verification'
    )
    action = models.CharField(
        max_length=10,
        choices=ACTION_CHOICES,
        help_text='Verification action taken'
    )
    rejection_reason = models.TextField(
        blank=True,
        null=True,
        help_text='Required if action is rejected'
    )
    rejection_category = models.CharField(
        max_length=30,
        choices=REJECTION_CATEGORY_CHOICES,
        blank=True,
        null=True,
        help_text='Structured rejection category'
    )
    notes = models.TextField(
        blank=True,
        null=True,
        help_text='Optional notes about the verification'
    )
    verified_at = models.DateTimeField(
        default=timezone.now,
        help_text='When verification was performed'
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='IP address of verifier (for audit)'
    )

    class Meta:
        ordering = ['-verified_at']
        verbose_name = 'Bookkeeper Verification'
        verbose_name_plural = 'Bookkeeper Verifications'
        indexes = [
            models.Index(fields=['application', 'verified_at']),
            models.Index(fields=['verified_by', 'verified_at']),
        ]

    def __str__(self):
        return f"{self.application} - {self.action} by {self.verified_by}"

    def clean(self):
        """Validate that rejection_reason is provided for rejections."""
        from django.core.exceptions import ValidationError

        if self.action == 'rejected' and not self.rejection_reason:
            raise ValidationError({
                'rejection_reason': 'Rejection reason is required when rejecting an application.'
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


class LoanAccountingEntry(models.Model):
    """
    Official accounting entry created by the Bookkeeper when recording a
    loan disbursement, repayment, or closure in the books.

    Workflow:
    1. AMO records a payment (payments.Payment created)
    2. Bookkeeper is notified
    3. Bookkeeper confirms via ConfirmPaymentView → creates LoanAccountingEntry
    """

    ENTRY_TYPE_CHOICES = [
        ('disbursement', 'Loan Disbursement'),
        ('repayment', 'Loan Repayment'),
        ('closure', 'Loan Closure'),
    ]

    application = models.ForeignKey(
        LoanApplication,
        on_delete=models.CASCADE,
        related_name='accounting_entries'
    )
    payment = models.OneToOneField(
        'payments.Payment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='accounting_entry',
        help_text='Linked payment record (null for disbursement/closure entries)'
    )
    entry_type = models.CharField(
        max_length=15,
        choices=ENTRY_TYPE_CHOICES,
        help_text='Type of accounting entry'
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Amount recorded in this entry'
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='accounting_entries',
        help_text='Bookkeeper who recorded this entry'
    )
    recorded_at = models.DateTimeField(
        auto_now_add=True,
        help_text='When this entry was recorded'
    )
    notes = models.TextField(
        blank=True,
        help_text='Optional bookkeeping notes'
    )

    class Meta:
        ordering = ['-recorded_at']
        verbose_name = 'Loan Accounting Entry'
        verbose_name_plural = 'Loan Accounting Entries'
        indexes = [
            models.Index(fields=['application', 'recorded_at']),
            models.Index(fields=['entry_type', 'recorded_at']),
        ]

    def __str__(self):
        return f"App #{self.application_id} — {self.get_entry_type_display()} — ₱{self.amount}"
