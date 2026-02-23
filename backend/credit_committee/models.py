"""
Credit Committee Module Models

Design Decisions:
1. CreditCommitteeDecision Model:
   - Tracks all Credit Committee decisions on loan applications
   - Immutable audit trail (no updates, only inserts)
   - Supports three decision types: approve, reject, return to treasurer
   - Includes meeting_date for compliance tracking
   - Committee member auto-populated from logged-in user

2. Design Principles:
   - Single Responsibility: Each model handles one concern
   - Audit Trail: All actions are logged with timestamps and IP
   - Data Integrity: Using ForeignKey with appropriate on_delete behavior
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
from loans.models import LoanApplication


class CreditCommitteeDecision(models.Model):
    """
    Tracks Credit Committee decisions on loan applications.

    Workflow:
    1. Treasurer recommends application (status: 'Pending Credit Committee')
    2. Credit Committee reviews and decides:
       - Approve: status -> 'Approved by Credit Committee'
       - Reject: status -> 'Rejected by Credit Committee'
       - Return to Treasurer: status -> 'Returned to Treasurer'
    """

    DECISION_CHOICES = [
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('returned', 'Returned to Treasurer'),
    ]

    application = models.ForeignKey(
        LoanApplication,
        on_delete=models.CASCADE,
        related_name='credit_committee_decisions',
        help_text='Loan application being decided'
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='credit_committee_decisions',
        help_text='Committee member who made the decision'
    )

    # Decision fields
    decision = models.CharField(
        max_length=20,
        choices=DECISION_CHOICES,
        help_text='Committee decision'
    )
    remarks = models.TextField(
        help_text='Required remarks explaining the decision'
    )
    meeting_date = models.DateField(
        help_text='Date of committee meeting when decision was made'
    )

    # Audit fields
    decided_at = models.DateTimeField(
        default=timezone.now,
        help_text='Timestamp when decision was recorded'
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='IP address for audit trail'
    )

    class Meta:
        ordering = ['-decided_at']
        verbose_name = 'Credit Committee Decision'
        verbose_name_plural = 'Credit Committee Decisions'
        indexes = [
            models.Index(fields=['application', 'decided_at']),
            models.Index(fields=['decided_by', 'decided_at']),
            models.Index(fields=['decision', 'decided_at']),
        ]

    def __str__(self):
        return f"{self.application} - {self.get_decision_display()} by {self.decided_by}"

    def clean(self):
        """Validate that remarks are provided."""
        if not self.remarks or not self.remarks.strip():
            raise ValidationError({
                'remarks': 'Remarks are required for all Credit Committee decisions.'
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
