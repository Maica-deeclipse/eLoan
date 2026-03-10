"""
Applicant Module Models

Models:
- ApplicantProfile: Extended profile information for applicants
- CoMakerInfo: Detailed co-maker information for loan applications
- ESignature: Electronic signature for loan applications
- LoanTypeCoMakerRequirement: Co-maker requirements per loan type
- Member: Membership profile linked to User (Applicant is a Member with pending status)
- Savings: Savings records for members
- SharedCapital: Shared capital records (determines membership classification)
- MembershipApprovalLog: Audit trail for approvals/rejections
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from decimal import Decimal


class ApplicantProfile(models.Model):
    """
    Extended profile for applicant users.
    Stores personal information for loan applications.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='applicant_profile'
    )

    # Contact Information
    contact_number = models.CharField(max_length=20, blank=True, null=True)
    secondary_contact = models.CharField(max_length=20, blank=True, null=True)

    # Address Fields
    address_line1 = models.CharField(max_length=255, blank=True, null=True)
    address_line2 = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    province = models.CharField(max_length=100, blank=True, null=True)
    zip_code = models.CharField(max_length=10, blank=True, null=True)

    # Employment Information
    employer_name = models.CharField(max_length=255, blank=True, null=True)
    employer_address = models.TextField(blank=True, null=True)
    position = models.CharField(max_length=100, blank=True, null=True)
    monthly_income = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )
    years_employed = models.IntegerField(null=True, blank=True)

    # Emergency Contact
    emergency_contact_name = models.CharField(max_length=100, blank=True, null=True)
    emergency_contact_number = models.CharField(max_length=20, blank=True, null=True)
    emergency_contact_relationship = models.CharField(max_length=50, blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Applicant Profile'
        verbose_name_plural = 'Applicant Profiles'

    def __str__(self):
        return f"Profile: {self.user.email}"

    @property
    def full_address(self):
        """Returns the full formatted address."""
        parts = [
            self.address_line1,
            self.address_line2,
            self.city,
            self.province,
            self.zip_code
        ]
        return ', '.join(filter(None, parts))


class CoMakerInfo(models.Model):
    """
    Detailed co-maker information for loan applications.
    Links to LoanCoMaker for relationship tracking.
    """
    loan_comaker = models.OneToOneField(
        'loans.LoanCoMaker',
        on_delete=models.CASCADE,
        related_name='detailed_info'
    )

    # Personal Details
    full_name = models.CharField(max_length=200)
    relationship_to_applicant = models.CharField(max_length=50)
    contact_number = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)

    # Address
    address = models.TextField()

    # Employment
    employer_name = models.CharField(max_length=255, blank=True, null=True)
    position = models.CharField(max_length=100, blank=True, null=True)
    monthly_income = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True
    )

    # Identification
    ID_TYPE_CHOICES = [
        ('philippine_id', 'Philippine National ID'),
        ('passport', 'Passport'),
        ('drivers_license', 'Driver\'s License'),
        ('sss_id', 'SSS ID'),
        ('philhealth_id', 'PhilHealth ID'),
        ('voters_id', 'Voter\'s ID'),
        ('postal_id', 'Postal ID'),
        ('prc_id', 'PRC ID'),
        ('other', 'Other Government ID'),
    ]
    id_type = models.CharField(max_length=50, choices=ID_TYPE_CHOICES)
    id_number = models.CharField(max_length=50)
    id_image_path = models.CharField(max_length=255, blank=True, null=True)

    # Digital Signature
    signature_image_path = models.CharField(max_length=255, blank=True, null=True)
    signed_at = models.DateTimeField(null=True, blank=True)

    # Consent
    consent_given = models.BooleanField(default=False)
    consent_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Co-Maker Information'
        verbose_name_plural = 'Co-Maker Information'

    def __str__(self):
        return f"CoMaker: {self.full_name}"


class ESignature(models.Model):
    """
    Electronic signature for loan applications.
    Stores signature image and metadata for legal compliance.
    """
    loan_application = models.OneToOneField(
        'loans.LoanApplication',
        on_delete=models.CASCADE,
        related_name='esignature'
    )

    signature_image_path = models.CharField(max_length=255)
    signed_at = models.DateTimeField(default=timezone.now)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_info = models.TextField(blank=True, null=True)

    # Terms acceptance
    terms_accepted = models.BooleanField(default=False)
    terms_version = models.CharField(max_length=20, default='1.0')

    class Meta:
        verbose_name = 'E-Signature'
        verbose_name_plural = 'E-Signatures'

    def __str__(self):
        return f"Signature for Application #{self.loan_application.id}"


class LoanTypeCoMakerRequirement(models.Model):
    """
    Defines co-maker requirements per loan type.

    Co-Maker Requirements:
    - 2 Co-Makers: Regular Loan, Gadget/Appliance Loan, Enhanced Regular Loan
    - 1 Co-Maker: Grace Loan
    - 0 Co-Makers: Petty Cash, Rice, Pamasahe, LAD, Grocery, Calamity, Financing
    """
    loan_type = models.OneToOneField(
        'loans.LoanType',
        on_delete=models.CASCADE,
        related_name='comaker_requirement'
    )
    required_comakers = models.IntegerField(
        default=0,
        help_text='Number of co-makers required (0, 1, or 2)'
    )

    class Meta:
        verbose_name = 'Loan Type Co-Maker Requirement'
        verbose_name_plural = 'Loan Type Co-Maker Requirements'

    def __str__(self):
        return f"{self.loan_type.loan_name}: {self.required_comakers} co-maker(s)"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.required_comakers < 0 or self.required_comakers > 2:
            raise ValidationError({
                'required_comakers': 'Required co-makers must be 0, 1, or 2.'
            })


# =============================================================================
# Membership Models
# =============================================================================

class Member(models.Model):
    """
    Member profile linked to User.
    An Applicant is essentially a Member - the User's account_status determines
    if they're pending, approved, or rejected.

    Membership Classification (auto-calculated based on shared capital):
    - Shared Capital < 20,000: Associate Member (max loan 20k)
    - Shared Capital >= 20,000: Regular Member (per loan type config)
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

    # Timestamps
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
        return self.savings_records.aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')

    @property
    def total_shared_capital(self):
        """Calculate total shared capital from all records."""
        return self.shared_capital_records.aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')

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
    Minimum required: PHP 200 to apply for loans.
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
        return f"{self.member.user.email} - {self.get_transaction_type_display()}: {self.amount}"

    def save(self, *args, **kwargs):
        # Ensure withdrawals are stored as negative values
        if self.transaction_type == 'withdrawal' and self.amount > 0:
            self.amount = -abs(self.amount)
        elif self.transaction_type == 'deposit' and self.amount < 0:
            self.amount = abs(self.amount)
        super().save(*args, **kwargs)


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
        return f"{self.member.user.email} - {self.get_transaction_type_display()}: {self.amount}"

    def save(self, *args, **kwargs):
        # Ensure withdrawals are stored as negative values
        if self.transaction_type == 'withdrawal' and self.amount > 0:
            self.amount = -abs(self.amount)
        elif self.transaction_type == 'contribution' and self.amount < 0:
            self.amount = abs(self.amount)
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
        return f"{self.user.email} - {self.get_action_display()} by {self.performed_by}"
