"""
Applicant Module Models

Models:
- CoMakerInfo: Detailed co-maker information for loan applications
- LoanTypeCoMakerRequirement: Co-maker requirements per loan type
- ApplicantBeneficiary: Beneficiaries declared by an applicant
- Savings: Savings records for members
- SharedCapital: Shared capital records (determines membership classification)
- MembershipApprovalLog: Audit trail for approvals/rejections
- MembershipAppeal: Appeal submitted by a rejected applicant

Note: ApplicantProfile and Member have been merged into users.Applicant.
"""

from django.db import models
from django.conf import settings
from decimal import Decimal


class ApplicantBeneficiary(models.Model):
    """
    Beneficiary declared by an applicant during registration.
    """
    profile = models.ForeignKey(
        'users.Applicant',
        on_delete=models.CASCADE,
        related_name='beneficiaries',
    )
    name = models.CharField(max_length=100)
    relationship = models.CharField(max_length=50)
    date_of_birth = models.DateField(blank=True, null=True)
    contact_number = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        verbose_name = 'Applicant Beneficiary'
        verbose_name_plural = 'Applicant Beneficiaries'

    def __str__(self):
        return f"{self.name} ({self.relationship})"


class CoMakerInfo(models.Model):
    """
    Detailed co-maker information for loan applications.
    Links to LoanCoMaker for relationship tracking.
    """
    loan_comaker = models.OneToOneField(
        'loans.LoanCoMaker',
        on_delete=models.CASCADE,
        related_name='detailed_info',
    )

    # Personal Details
    full_name = models.CharField(max_length=200)
    relationship_to_applicant = models.CharField(max_length=50)
    contact_number = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)

    # Address
    address = models.TextField()
    years_in_address = models.IntegerField(null=True, blank=True)

    # Personal / Family
    spouse_name = models.CharField(max_length=200, blank=True, null=True)
    no_of_dependents = models.IntegerField(null=True, blank=True)

    # Employment
    employer_name = models.CharField(max_length=255, blank=True, null=True)
    position = models.CharField(max_length=100, blank=True, null=True)
    monthly_income = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    other_income_source = models.CharField(max_length=200, blank=True, null=True)
    other_income_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Bank Reference
    BANK_ACCOUNT_TYPE_CHOICES = [
        ('checking', 'Checking'),
        ('td_savings', 'TD/Savings'),
    ]
    bank_reference_name = models.CharField(max_length=200, blank=True, null=True)
    bank_account_type = models.CharField(max_length=20, choices=BANK_ACCOUNT_TYPE_CHOICES, blank=True, null=True)

    # Identification
    ID_TYPE_CHOICES = [
        ('philippine_id', 'Philippine National ID'),
        ('passport', 'Passport'),
        ('drivers_license', "Driver's License"),
        ('sss_id', 'SSS ID'),
        ('philhealth_id', 'PhilHealth ID'),
        ('voters_id', "Voter's ID"),
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
        related_name='comaker_requirement',
    )
    required_comakers = models.IntegerField(
        default=0,
        help_text='Number of co-makers required (0, 1, or 2)',
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
# Savings & Shared Capital
# =============================================================================

class Savings(models.Model):
    """
    Savings records for members.
    Minimum required: PHP 200 to apply for loans.
    """
    member = models.ForeignKey(
        'users.Applicant',
        on_delete=models.CASCADE,
        related_name='savings_records',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(
        max_length=20,
        choices=[
            ('deposit', 'Deposit'),
            ('withdrawal', 'Withdrawal'),
        ],
        default='deposit',
    )
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='savings_recorded',
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Savings Record'
        verbose_name_plural = 'Savings Records'
        ordering = ['-recorded_at']

    def __str__(self):
        return f"{self.member.email} - {self.get_transaction_type_display()}: {self.amount}"

    def save(self, *args, **kwargs):
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
        'users.Applicant',
        on_delete=models.CASCADE,
        related_name='shared_capital_records',
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(
        max_length=20,
        choices=[
            ('contribution', 'Contribution'),
            ('withdrawal', 'Withdrawal'),
        ],
        default='contribution',
    )
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)

    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='shared_capital_recorded',
    )
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Shared Capital Record'
        verbose_name_plural = 'Shared Capital Records'
        ordering = ['-recorded_at']

    def __str__(self):
        return f"{self.member.email} - {self.get_transaction_type_display()}: {self.amount}"

    def save(self, *args, **kwargs):
        if self.transaction_type == 'withdrawal' and self.amount > 0:
            self.amount = -abs(self.amount)
        elif self.transaction_type == 'contribution' and self.amount < 0:
            self.amount = abs(self.amount)
        super().save(*args, **kwargs)
        self.member.update_membership_classification()


# =============================================================================
# Membership Approval & Appeal
# =============================================================================

class MembershipApprovalLog(models.Model):
    """
    Audit trail for membership approvals/rejections by Account Member Officer.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='membership_approval_logs',
    )
    action = models.CharField(
        max_length=20,
        choices=[
            ('approved', 'Approved'),
            ('rejected', 'Rejected'),
            ('appeal_submitted', 'Appeal Submitted'),
            ('appeal_approved', 'Appeal Approved'),
            ('appeal_rejected', 'Appeal Rejected'),
        ],
    )
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='membership_actions_performed',
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


class MembershipAppeal(models.Model):
    """
    Appeal submitted by a rejected applicant.
    AMO reviews and decides to approve or reject the appeal.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='membership_appeal',
    )
    reason = models.TextField(help_text='Reason for appeal submitted by the applicant.')
    submitted_at = models.DateTimeField(auto_now_add=True)

    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='appeals_reviewed',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = 'Membership Appeal'
        verbose_name_plural = 'Membership Appeals'
        ordering = ['-submitted_at']

    def __str__(self):
        return f"Appeal by {self.user.email} - {self.get_status_display()}"
