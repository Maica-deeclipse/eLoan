from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum
from django.db.models.functions import Coalesce
from decimal import Decimal


class LoanType(models.Model):
    loan_name = models.CharField(max_length=100, unique=True, null=True, blank=True)
    min_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    max_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    max_term_months = models.IntegerField(default=0)
    required_comakers = models.IntegerField(default=0, help_text='Number of co-makers required for this loan type')
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return self.loan_name

    class Meta:
        ordering = ['loan_name']


class ApplicationStatus(models.Model):
    status_name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.status_name


class LoanApplication(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="loan_applications")
    loan_type = models.ForeignKey(LoanType, on_delete=models.CASCADE, related_name="loan_applications")
    amount_requested = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    term_months = models.IntegerField(null=True, blank=True)

    monthly_amortization = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    total_payable = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    purpose = models.TextField(null=True, blank=True)
    application_date = models.DateTimeField(default=timezone.now)
    current_status = models.ForeignKey(ApplicationStatus, on_delete=models.SET_NULL, null=True, blank=True)

    # Treasurer evaluation fields
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True,
                                      help_text='Net monthly salary from payslip')
    forwarded_to_treasurer_at = models.DateTimeField(null=True, blank=True,
                                                      help_text='When application was forwarded to treasurer')

    def __str__(self):
        return f"{self.user} - {self.loan_type.loan_name} - {self.amount_requested}"

    @property
    def total_paid(self):
        total = self.payments.aggregate(total=Coalesce(Sum('amount_paid'), Decimal('0.00')))['total']
        return total or Decimal('0.00')

    @property
    def remaining_balance(self):
        """Calculate remaining loan balance."""
        if self.total_payable:
            return self.total_payable - self.total_paid
        return Decimal('0.00')

    @property
    def is_fully_paid(self):
        """Check if loan is fully paid."""
        return self.remaining_balance <= 0


class LoanCoMaker(models.Model):
    application = models.ForeignKey(LoanApplication, on_delete=models.CASCADE, related_name='comakers')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    agreed_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('application', 'user')


class LoanDocument(models.Model):
    loan_application = models.ForeignKey(LoanApplication, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=50, null=True, blank=True)
    file_path = models.CharField(max_length=255, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True, null=True)
    verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    verified_at = models.DateTimeField(null=True, blank=True)


class FaceVerification(models.Model):
    loan_application = models.ForeignKey(LoanApplication, on_delete=models.CASCADE, related_name='face_verifications')

    # Image paths
    captured_image_path = models.CharField(max_length=255, null=True, blank=True, help_text='Path to captured selfie')
    id_photo_path = models.CharField(max_length=255, null=True, blank=True, help_text='Path to ID photo extracted from document')

    # Legacy field (kept for backward compatibility)
    match_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Legacy match score field')

    # Face detection status
    face_detected_in_id = models.BooleanField(default=False, help_text='Whether a face was detected in ID photo')
    face_detected_in_selfie = models.BooleanField(default=False, help_text='Whether a face was detected in selfie')

    # DeepFace comparison results
    similarity_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='DeepFace similarity score (0-100)')
    comparison_model = models.CharField(max_length=50, default='ArcFace', help_text='Face comparison model used')
    comparison_distance = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True, help_text='Raw distance metric from DeepFace')
    comparison_threshold = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, help_text='Threshold used for verification')
    is_match = models.BooleanField(null=True, blank=True, help_text='Whether faces match based on threshold')

    # Error handling
    error_message = models.TextField(null=True, blank=True, help_text='Error message if verification failed')

    # Status and timestamps
    verification_status = models.CharField(max_length=20, default='Pending')
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    verified_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True, help_text='When face comparison was performed')
    created_at = models.DateTimeField(auto_now_add=True, null=True)


class LivenessCheck(models.Model):
    """
    Stores liveness detection results using MediaPipe.

    Methods:
    - blink: Eye blink detection using Eye Aspect Ratio (EAR)
    - head_turn: Head pose detection (yaw angle)
    - head_nod: Head pose detection (pitch angle)
    - combined: Multiple checks combined

    Check Status:
    - Pending: Not yet processed
    - Verified: Liveness confirmed
    - Failed: Liveness check failed
    """
    loan_application = models.ForeignKey(LoanApplication, on_delete=models.CASCADE, related_name='liveness_checks')
    method = models.CharField(max_length=20, null=True, blank=True,
                              help_text='Detection method: blink, head_turn, head_nod, combined')
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True,
                                           help_text='Confidence score 0-100')
    check_status = models.CharField(max_length=20, default='Pending',
                                    help_text='Pending, Verified, or Failed')

    # MediaPipe detection details (stored as JSON-like text for flexibility)
    detection_details = models.TextField(null=True, blank=True,
                                         help_text='JSON details from MediaPipe detection')

    # Eye Aspect Ratio for blink detection
    left_ear = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True,
                                   help_text='Left Eye Aspect Ratio')
    right_ear = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True,
                                    help_text='Right Eye Aspect Ratio')
    avg_ear = models.DecimalField(max_digits=5, decimal_places=4, null=True, blank=True,
                                  help_text='Average Eye Aspect Ratio')
    eyes_open = models.BooleanField(null=True, blank=True,
                                    help_text='Whether eyes were detected as open')

    # Head pose for movement detection
    head_yaw = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True,
                                   help_text='Head yaw angle in degrees')
    head_pitch = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True,
                                     help_text='Head pitch angle in degrees')
    head_roll = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True,
                                    help_text='Head roll angle in degrees')

    # Image path
    image_path = models.CharField(max_length=255, null=True, blank=True,
                                  help_text='Path to the liveness check image')

    # Error tracking
    error_message = models.TextField(null=True, blank=True,
                                     help_text='Error message if check failed')

    # Verification metadata
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='+')
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"LivenessCheck #{self.id} - {self.method} - {self.check_status}"


class AuditLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True, null=True)
    ip_address = models.CharField(max_length=50, null=True, blank=True)


class StatusChangeLog(models.Model):
    """
    Tracks all status changes for loan applications.
    Auto-populated via Django signals for clean architecture.
    """
    application = models.ForeignKey(
        LoanApplication,
        on_delete=models.CASCADE,
        related_name='status_change_logs'
    )
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='status_changes_made'
    )
    changed_by_role = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        help_text='Role of the user who made the change'
    )
    from_status = models.ForeignKey(
        ApplicationStatus,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='status_changes_from',
        help_text='Previous status'
    )
    to_status = models.ForeignKey(
        ApplicationStatus,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='status_changes_to',
        help_text='New status'
    )
    changed_at = models.DateTimeField(default=timezone.now)
    remarks = models.TextField(
        null=True,
        blank=True,
        help_text='Optional remarks/reason for status change'
    )

    class Meta:
        ordering = ['-changed_at']
        verbose_name = 'Status Change Log'
        verbose_name_plural = 'Status Change Logs'
        indexes = [
            models.Index(fields=['application', 'changed_at']),
            models.Index(fields=['changed_by', 'changed_at']),
        ]

    def __str__(self):
        from_name = self.from_status.status_name if self.from_status else 'None'
        to_name = self.to_status.status_name if self.to_status else 'None'
        return f"App #{self.application_id}: {from_name} → {to_name}"


class StatusTransitionRule(models.Model):
    """
    Defines allowed status transitions per role.
    Used to enforce role-based workflow rules.
    """
    from_status = models.ForeignKey(
        ApplicationStatus,
        on_delete=models.CASCADE,
        related_name='transition_rules_from'
    )
    to_status = models.ForeignKey(
        ApplicationStatus,
        on_delete=models.CASCADE,
        related_name='transition_rules_to'
    )
    allowed_role = models.CharField(
        max_length=50,
        help_text='Role allowed to make this transition (e.g., Applicant, Bookkeeper, Treasurer, Credit Committee)'
    )

    class Meta:
        unique_together = ('from_status', 'to_status', 'allowed_role')
        verbose_name = 'Status Transition Rule'
        verbose_name_plural = 'Status Transition Rules'

    def __str__(self):
        return f"{self.from_status} → {self.to_status} ({self.allowed_role})"

    @classmethod
    def is_transition_allowed(cls, from_status, to_status, role_name):
        """
        Check if a status transition is allowed for a given role.

        Args:
            from_status: ApplicationStatus instance or None
            to_status: ApplicationStatus instance
            role_name: String name of the role

        Returns:
            bool: True if transition is allowed
        """
        # Allow initial status assignment (from None)
        if from_status is None:
            return True

        return cls.objects.filter(
            from_status=from_status,
            to_status=to_status,
            allowed_role=role_name
        ).exists()
