"""
Applicant Module Models

Models:
- ApplicantProfile: Extended profile information for applicants
- CoMakerInfo: Detailed co-maker information for loan applications
- ESignature: Electronic signature for loan applications
- LoanTypeCoMakerRequirement: Co-maker requirements per loan type
"""

from django.db import models
from django.conf import settings
from django.utils import timezone


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
