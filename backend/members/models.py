from django.db import models
from django.conf import settings
from decimal import Decimal


class Member(models.Model):
    """
    Member profile linked to User.
    Contains cooperative membership-specific data.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='member_profile'
    )

    MEMBERSHIP_CHOICES = [
        ('associate', 'Associate Member'),
        ('regular', 'Regular Member'),
    ]
    membership_type = models.CharField(
        max_length=20,
        choices=MEMBERSHIP_CHOICES,
        default='associate'
    )

    member_since = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Member'
        verbose_name_plural = 'Members'

    def __str__(self):
        return f"{self.user.firstname} {self.user.lastname} ({self.get_membership_type_display()})"

    @property
    def total_savings(self):
        """Calculate total savings from all savings records."""
        total = self.savings_records.aggregate(
            total=models.Sum('amount')
        )['total']
        return total or Decimal('0.00')

    @property
    def total_shared_capital(self):
        """Calculate total shared capital from all records."""
        total = self.shared_capital_records.aggregate(
            total=models.Sum('amount')
        )['total']
        return total or Decimal('0.00')

    @property
    def calculated_membership_type(self):
        """Auto-calculate membership based on shared capital."""
        if self.total_shared_capital >= Decimal('20000.00'):
            return 'regular'
        return 'associate'

    @property
    def max_loan_amount(self):
        """Return maximum loan amount based on membership type."""
        if self.membership_type == 'associate':
            return Decimal('20000.00')
        return None  # Regular members use LoanType config

    def update_membership_classification(self):
        """Recalculate and update membership type based on shared capital."""
        new_type = self.calculated_membership_type
        if self.membership_type != new_type:
            self.membership_type = new_type
            self.save(update_fields=['membership_type', 'updated_at'])
        return self.membership_type


class Savings(models.Model):
    """
    Savings records for members.
    Minimum required: PHP 200 to be eligible for loans.
    """
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='savings_records'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(
        max_length=20,
        choices=[
            ('deposit', 'Deposit'),
            ('withdrawal', 'Withdrawal'),
        ],
        default='deposit'
    )
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)

    # Audit fields
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='savings_recorded'
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Savings Record'
        verbose_name_plural = 'Savings Records'
        ordering = ['-recorded_at']

    def __str__(self):
        return f"{self.member.user.email} - {self.transaction_type}: {self.amount}"


class SharedCapital(models.Model):
    """
    Shared Capital records for members.
    Determines membership classification:
    - < 20,000: Associate Member
    - >= 20,000: Regular Member
    """
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name='shared_capital_records'
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(
        max_length=20,
        choices=[
            ('contribution', 'Contribution'),
            ('withdrawal', 'Withdrawal'),
        ],
        default='contribution'
    )
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)

    # Audit fields
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='shared_capital_recorded'
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Shared Capital Record'
        verbose_name_plural = 'Shared Capital Records'
        ordering = ['-recorded_at']

    def __str__(self):
        return f"{self.member.user.email} - {self.transaction_type}: {self.amount}"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Auto-update membership classification when shared capital changes
        self.member.update_membership_classification()


class MembershipApprovalLog(models.Model):
    """
    Audit trail for membership approvals/rejections by Super Admin.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='membership_approval_logs'
    )
    action = models.CharField(
        max_length=20,
        choices=[
            ('approved', 'Approved'),
            ('rejected', 'Rejected'),
        ]
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='membership_actions_performed'
    )
    rejection_reason = models.TextField(blank=True, null=True)
    performed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        verbose_name = 'Membership Approval Log'
        verbose_name_plural = 'Membership Approval Logs'
        ordering = ['-performed_at']

    def __str__(self):
        return f"{self.user.email} - {self.action} by {self.performed_by}"
