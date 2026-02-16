from django.db import models
from django.utils import timezone
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver


class Payment(models.Model):
    PAYMENT_METHOD_CHOICES = [
        ('Cash', 'Cash'),
        ('Bank Transfer', 'Bank Transfer'),
        ('Payroll Deduction', 'Payroll Deduction'),
        ('Other', 'Other'),
    ]

    application = models.ForeignKey(
        'loans.LoanApplication',
        on_delete=models.CASCADE,
        related_name='payments',
        null=True,
        blank=True
    )
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    payment_date = models.DateField(default=timezone.now)
    payment_method = models.CharField(max_length=50, choices=PAYMENT_METHOD_CHOICES, null=True, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    remarks = models.CharField(max_length=255, null=True, blank=True)

    class Meta:
        ordering = ['-payment_date']

    def __str__(self):
        return f"{self.application} - {self.amount_paid} - {self.payment_method}"


@receiver(post_save, sender=Payment)
def update_loan_status_after_payment(sender, instance, created, **kwargs):
    if not created:
        return
    loan = instance.application
    try:
        total_paid = loan.payments.aggregate(total=models.Sum('amount_paid'))['total'] or 0
        if total_paid >= loan.total_payable:
            paid_status = None
            # find status named 'Paid' if it exists
            from loans.models import ApplicationStatus
            try:
                paid_status = ApplicationStatus.objects.get(status_name__iexact='Paid')
            except ApplicationStatus.DoesNotExist:
                paid_status = None

            if paid_status:
                loan.current_status = paid_status
                loan.save(update_fields=['current_status'])
    except Exception:
        pass
