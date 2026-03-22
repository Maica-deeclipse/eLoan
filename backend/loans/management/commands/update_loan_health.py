"""
Management command to update loan health statuses based on payment due dates.

Run daily (e.g., via cron or Windows Task Scheduler):
    python manage.py update_loan_health

Health Status Rules:
    on_time   — no overdue installments
    late      — oldest overdue installment is 1-29 days past due
    overdue   — oldest overdue installment is 30-89 days past due
    delinquent — oldest overdue installment is 90+ days past due
"""

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Update loan health statuses (on_time/late/overdue/delinquent) for all active loans'

    def handle(self, *args, **options):
        from loans.models import LoanApplication, ApplicationStatus, PaymentSchedule
        from datetime import date

        today = date.today()
        updated_count = 0
        skipped_count = 0

        active_statuses = ['Active', 'Disbursed']
        active_loans = LoanApplication.objects.filter(
            current_status__status_name__in=active_statuses
        ).select_related('current_status')

        self.stdout.write(f"Checking {active_loans.count()} active loans...")

        for loan in active_loans:
            # Get all unpaid/partial installments ordered by due date
            unpaid = PaymentSchedule.objects.filter(
                application=loan,
            ).exclude(status='paid').order_by('due_date')

            if not unpaid.exists():
                # All installments paid but loan still active — skip (closure signal handles this)
                skipped_count += 1
                continue

            # Find the oldest unpaid installment
            oldest_unpaid = unpaid.first()

            if oldest_unpaid.due_date > today:
                # Not yet due
                new_health = 'on_time'
            else:
                days_overdue = (today - oldest_unpaid.due_date).days
                if days_overdue < 30:
                    new_health = 'late'
                elif days_overdue < 90:
                    new_health = 'overdue'
                else:
                    new_health = 'delinquent'

            # Update PaymentSchedule item statuses for past-due items
            for installment in unpaid:
                if installment.due_date <= today and installment.status == 'pending':
                    days_past = (today - installment.due_date).days
                    if days_past < 30:
                        installment.status = 'late'
                    else:
                        installment.status = 'overdue'
                    installment.save(update_fields=['status'])

            if loan.loan_health_status != new_health:
                loan.loan_health_status = new_health
                loan.save(update_fields=['loan_health_status'])
                updated_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"  Loan #{loan.id}: {loan.loan_health_status or 'None'} → {new_health}"
                    )
                )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f"Done. Updated: {updated_count}, Skipped: {skipped_count}"))
