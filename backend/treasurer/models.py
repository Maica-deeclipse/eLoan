"""
Treasurer Module Models

Design Decisions:
1. TreasurerEvaluation Model:
   - Tracks all treasurer evaluation actions on loan applications
   - Immutable audit trail (no updates, only inserts)
   - Stores DTI calculation, recommendation, and remarks
   - Links to net_salary for audit purposes

2. Design Principles:
   - Single Responsibility: Each model handles one concern
   - Audit Trail: All actions are logged with timestamps
   - Data Integrity: Using ForeignKey with appropriate on_delete behavior
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from loans.models import LoanApplication


class TreasurerEvaluation(models.Model):
    """
    Tracks treasurer evaluation actions on loan applications.
    Similar to BookkeeperVerification but with treasurer-specific fields.

    Workflow:
    1. Bookkeeper verifies application (status: 'Verified by Bookkeeper')
    2. Treasurer evaluates and recommends (status: 'Pending Credit Committee')
       OR doesn't recommend (status: 'Rejected by Treasurer')
    3. Recommended applications move to Credit Committee queue
    """

    RECOMMENDATION_CHOICES = [
        ('recommend', 'Recommend'),
        ('not_recommend', 'Not Recommend'),
    ]

    application = models.ForeignKey(
        LoanApplication,
        on_delete=models.CASCADE,
        related_name='treasurer_evaluations',
        help_text='Loan application being evaluated'
    )
    evaluated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='treasurer_evaluations',
        help_text='Treasurer who performed the evaluation'
    )

    # DTI Calculation fields
    net_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Net monthly salary at time of evaluation'
    )
    computed_monthly_amortization = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text='Monthly amortization from application'
    )
    dti_ratio = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text='Debt-to-Income ratio percentage'
    )

    # Evaluation decision
    recommendation = models.CharField(
        max_length=20,
        choices=RECOMMENDATION_CHOICES,
        help_text='Treasurer recommendation'
    )
    remarks = models.TextField(
        blank=True,
        null=True,
        help_text='Additional remarks or notes'
    )

    evaluated_at = models.DateTimeField(
        default=timezone.now,
        help_text='When evaluation was performed'
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text='IP address of evaluator (for audit)'
    )

    class Meta:
        ordering = ['-evaluated_at']
        verbose_name = 'Treasurer Evaluation'
        verbose_name_plural = 'Treasurer Evaluations'
        indexes = [
            models.Index(fields=['application', 'evaluated_at']),
            models.Index(fields=['evaluated_by', 'evaluated_at']),
        ]

    def __str__(self):
        return f"{self.application} - {self.recommendation} by {self.evaluated_by}"

    def save(self, *args, **kwargs):
        # Auto-calculate DTI if not set
        if self.net_salary and self.computed_monthly_amortization and not self.dti_ratio:
            self.dti_ratio = (self.computed_monthly_amortization / self.net_salary) * 100
        super().save(*args, **kwargs)
