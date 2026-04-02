from django.db import models
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.utils import timezone
from decimal import Decimal


class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Please enter an email address')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    role = models.ForeignKey(Role, on_delete=models.PROTECT, null=True, blank=True)
    firstname = models.CharField(max_length=50)
    lastname = models.CharField(max_length=50)
    email = models.EmailField(unique=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', blank=True, null=True)

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('suspended', 'Suspended'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')

    ACCOUNT_STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    account_status = models.CharField(
        max_length=20,
        choices=ACCOUNT_STATUS_CHOICES,
        default='approved',
    )
    approved_by = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='approved_users',
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['firstname', 'lastname']

    def __str__(self):
        return f"{self.firstname} {self.lastname} <{self.email}>"


class UserPreferences(models.Model):
    """User preferences for notifications and other settings."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='preferences')
    email_notifications = models.BooleanField(default=True)
    in_app_notifications = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'User Preferences'

    def __str__(self):
        return f"Preferences for {self.user.email}"


# =============================================================================
# Applicant — consolidates User + ApplicantProfile + Member
# =============================================================================

ASSOCIATE_ONLY_STATUSES = {'part_time', 'job_order'}
REGULAR_ELIGIBLE_STATUSES = {'permanent', 'temporary', 'casual'}


class Applicant(User):
    """
    Applicant/Member user.
    Extends User (multi-table inheritance) with all profile and membership fields.
    DB table: users_applicant
    """

    # ---- Contact ----
    contact_number = models.CharField(max_length=20, blank=True, null=True)
    secondary_contact = models.CharField(max_length=20, blank=True, null=True)

    # ---- Present Address ----
    address_line1 = models.CharField(max_length=255, blank=True, null=True)
    address_line2 = models.CharField(max_length=255, blank=True, null=True)  # barangay
    city = models.CharField(max_length=100, blank=True, null=True)
    province = models.CharField(max_length=100, blank=True, null=True)
    zip_code = models.CharField(max_length=10, blank=True, null=True)

    # ---- Permanent Address ----
    permanent_address_line1 = models.CharField(max_length=255, blank=True, null=True)
    permanent_address_barangay = models.CharField(max_length=255, blank=True, null=True)
    permanent_city = models.CharField(max_length=100, blank=True, null=True)
    permanent_province = models.CharField(max_length=100, blank=True, null=True)
    permanent_zip_code = models.CharField(max_length=10, blank=True, null=True)

    # ---- Personal Info ----
    CIVIL_STATUS_CHOICES = [
        ('single', 'Single'),
        ('married', 'Married'),
        ('widowed', 'Widowed'),
        ('separated', 'Separated'),
    ]
    civil_status = models.CharField(max_length=20, choices=CIVIL_STATUS_CHOICES, blank=True, null=True)

    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
    ]
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    middle_name = models.CharField(max_length=50, blank=True, null=True)
    citizenship = models.CharField(max_length=50, blank=True, null=True, default='Filipino')
    spouse_name = models.CharField(max_length=100, blank=True, null=True)
    date_of_birth = models.DateField(blank=True, null=True)
    tin = models.CharField(max_length=20, blank=True, null=True, help_text='Tax Identification Number')
    sss_number = models.CharField(max_length=30, blank=True, null=True, help_text='SSS Number')

    HIGHEST_EDUCATION_CHOICES = [
        ('elementary', 'Elementary'),
        ('high_school', 'High School'),
        ('vocational', 'Vocational/Technical'),
        ('college', 'College'),
        ('post_graduate', 'Post-Graduate'),
    ]
    highest_education = models.CharField(max_length=20, choices=HIGHEST_EDUCATION_CHOICES, blank=True, null=True)

    # ---- Employment (self-reported) ----
    EMPLOYMENT_CATEGORY_CHOICES = [
        ('teaching', 'Teaching'),
        ('non_teaching', 'Non-Teaching'),
        ('others', 'Others'),
    ]
    employment_category = models.CharField(max_length=20, choices=EMPLOYMENT_CATEGORY_CHOICES, blank=True, null=True)

    EMPLOYMENT_STATUS_CHOICES = [
        ('regular', 'Regular'),
        ('casual', 'Casual'),
        ('job_order', 'Job Order'),
        ('part_time', 'Part-time'),
    ]
    employment_status = models.CharField(
        max_length=20,
        choices=EMPLOYMENT_STATUS_CHOICES,
        default='regular',
    )

    buksu_id_number = models.CharField(max_length=50, blank=True, null=True, help_text='BukSU ID Number')
    office = models.CharField(max_length=100, blank=True, null=True, help_text='Office/Department')
    employer_name = models.CharField(max_length=255, blank=True, null=True)
    employer_address = models.TextField(blank=True, null=True)
    position = models.CharField(max_length=100, blank=True, null=True)
    monthly_income = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    net_take_home_pay = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text='Net take-home pay after deductions',
    )
    years_employed = models.IntegerField(null=True, blank=True)

    # ---- Parents ----
    father_name = models.CharField(max_length=100, blank=True, null=True)
    father_occupation = models.CharField(max_length=100, blank=True, null=True)
    father_contact = models.CharField(max_length=20, blank=True, null=True)
    mother_name = models.CharField(max_length=100, blank=True, null=True)
    mother_occupation = models.CharField(max_length=100, blank=True, null=True)
    mother_contact = models.CharField(max_length=20, blank=True, null=True)

    # ---- Emergency Contact ----
    emergency_contact_name = models.CharField(max_length=100, blank=True, null=True)
    emergency_contact_number = models.CharField(max_length=20, blank=True, null=True)
    emergency_contact_relationship = models.CharField(max_length=50, blank=True, null=True)

    # ---- Documents ----
    id_photo = models.ImageField(upload_to='applicant_documents/id_photos/', blank=True, null=True)
    payslip = models.FileField(upload_to='applicant_documents/payslips/', blank=True, null=True)
    coe_document = models.FileField(upload_to='membership_documents/coe/', blank=True, null=True)
    membership_form = models.FileField(upload_to='membership_documents/forms/', blank=True, null=True)

    # ---- Membership (from Member) ----
    MEMBERSHIP_CHOICES = [
        ('associate', 'Associate Member'),
        ('regular', 'Regular Member'),
    ]
    membership_type = models.CharField(max_length=20, choices=MEMBERSHIP_CHOICES, default='associate')

    fixed_deposit = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text='Fixed deposit in PHP. >= 20,000 qualifies for Regular membership.',
    )

    VERIFIED_EMPLOYMENT_STATUS_CHOICES = [
        ('permanent', 'Permanent'),
        ('temporary', 'Temporary'),
        ('casual', 'Casual'),
        ('part_time', 'Part-Time / Contract of Service'),
        ('job_order', 'Job Order'),
    ]
    verified_employment_status = models.CharField(
        max_length=20,
        choices=VERIFIED_EMPLOYMENT_STATUS_CHOICES,
        null=True,
        blank=True,
        help_text='Employment status verified by Account Member Officer after reviewing COE/proof.',
    )
    employment_status_verified_at = models.DateTimeField(null=True, blank=True)
    employment_status_verified_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employment_verifications_done',
    )

    MEMBERSHIP_STATUS_CHOICES = [
        ('active', 'Active'),
        ('under_review', 'Under Review'),
        ('warned', 'Warned'),
        ('suspended', 'Suspended'),
        ('terminated', 'Terminated'),
        ('voluntary_withdrawal', 'Voluntary Withdrawal'),
        ('deceased', 'Deceased'),
    ]
    membership_status = models.CharField(
        max_length=25,
        choices=MEMBERSHIP_STATUS_CHOICES,
        default='active',
    )

    subscribed_shares = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Number of shares subscribed. Minimum: 20 (By-Laws Section 3c & 6).',
    )
    paid_shares = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Number of shares paid up. Minimum: 5 (By-Laws Section 3c & 6).',
    )

    # Set manually when the applicant is approved (not auto_now_add)
    member_since = models.DateField(null=True, blank=True)

    # ---- Timestamps ----
    profile_created_at = models.DateTimeField(auto_now_add=True)
    profile_updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users_applicant'
        verbose_name = 'Applicant'
        verbose_name_plural = 'Applicants'

    def __str__(self):
        return f"{self.firstname} {self.lastname} ({self.get_membership_type_display()})"

    @property
    def full_address(self):
        parts = [self.address_line1, self.address_line2, self.city, self.province, self.zip_code]
        return ', '.join(filter(None, parts))

    @property
    def total_savings(self):
        return self.savings_records.aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')

    @property
    def total_shared_capital(self):
        return self.shared_capital_records.aggregate(
            total=models.Sum('amount')
        )['total'] or Decimal('0.00')

    @property
    def calculated_membership_type(self):
        """
        Auto-calculate membership type based on by-laws:
        1. part_time / job_order → ALWAYS associate
        2. permanent / temporary / casual + fixed_deposit >= 20,000 → regular
        3. No verified employment status → associate by default
        """
        emp_status = self.verified_employment_status
        if not emp_status:
            return 'associate'
        if emp_status in ASSOCIATE_ONLY_STATUSES:
            return 'associate'
        if emp_status in REGULAR_ELIGIBLE_STATUSES:
            if self.fixed_deposit is not None and self.fixed_deposit >= Decimal('20000.00'):
                return 'regular'
        return 'associate'

    @property
    def max_loan_amount(self):
        if self.membership_type == 'associate':
            return Decimal('20000.00')
        return None  # Regular members use LoanType config

    @property
    def is_in_good_standing(self):
        return self.membership_status in ('active', 'warned')

    def update_membership_classification(self):
        new_type = self.calculated_membership_type
        if self.membership_type != new_type:
            self.membership_type = new_type
            self.save(update_fields=['membership_type', 'profile_updated_at'])
        return self.membership_type

    def clean(self):
        from django.core.exceptions import ValidationError
        errors = {}

        if self.subscribed_shares is not None:
            if self.subscribed_shares < 20:
                errors['subscribed_shares'] = (
                    'A member must subscribe at least 20 shares (By-Laws Section 3c & 6).'
                )
            else:
                other_total = (
                    Applicant.objects
                    .exclude(pk=self.pk)
                    .aggregate(total=models.Sum('subscribed_shares'))['total'] or 0
                )
                if other_total > 0:
                    new_total = other_total + self.subscribed_shares
                    if self.subscribed_shares / new_total > Decimal('0.10'):
                        errors['subscribed_shares'] = (
                            f'Subscribed shares ({self.subscribed_shares}) would give this member more than 10% '
                            f'of total cooperative subscribed share capital '
                            f'({self.subscribed_shares} of {new_total}). By-Laws Section 6.'
                        )

        if self.paid_shares is not None:
            if self.paid_shares < 5:
                errors['paid_shares'] = (
                    'A member must pay up at least 5 shares (By-Laws Section 3c & 6).'
                )
            if (
                self.subscribed_shares is not None
                and self.paid_shares > self.subscribed_shares
            ):
                errors['paid_shares'] = 'Paid shares cannot exceed subscribed shares.'

        if errors:
            raise ValidationError(errors)


# =============================================================================
# AdminUser — staff members (Bookkeeper, Treasurer, Credit Committee, AMO)
# =============================================================================

class AdminUser(User):
    """
    Administrative staff user.
    Extends User (multi-table inheritance) with staff-specific fields.
    SuperAdmin stays in users_user only (no AdminUser row).
    DB table: users_admin
    """
    employee_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    department = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = 'users_admin'
        verbose_name = 'Admin User'
        verbose_name_plural = 'Admin Users'

    def __str__(self):
        role_name = self.role.name if self.role else 'Staff'
        return f"{self.firstname} {self.lastname} ({role_name})"
