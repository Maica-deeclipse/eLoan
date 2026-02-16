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
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return self.loan_name


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
    captured_image_path = models.CharField(max_length=255, null=True, blank=True)
    match_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    verification_status = models.CharField(max_length=20, default='Pending')
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)


class LivenessCheck(models.Model):
    loan_application = models.ForeignKey(LoanApplication, on_delete=models.CASCADE, related_name='liveness_checks')
    method = models.CharField(max_length=20, null=True, blank=True)
    confidence_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    check_status = models.CharField(max_length=20, default='Pending')
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)


class AuditLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True, null=True)
    ip_address = models.CharField(max_length=50, null=True, blank=True)
