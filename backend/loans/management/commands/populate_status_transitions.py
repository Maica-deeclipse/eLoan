"""
Management command to populate default status transition rules.

Usage:
    python manage.py populate_status_transitions

This creates the allowed status transitions for each role in the loan workflow.
"""

from django.core.management.base import BaseCommand
from loans.models import ApplicationStatus, StatusTransitionRule


class Command(BaseCommand):
    help = 'Populate default status transition rules for loan workflow'

    # Define the workflow transitions
    # Format: (from_status, to_status, allowed_role)
    TRANSITIONS = [
        # Applicant transitions
        ('Draft', 'Submitted', 'Applicant'),
        ('Submitted', 'Withdrawn', 'Applicant'),

        # Bookkeeper transitions
        ('Submitted', 'Verified by Bookkeeper', 'Bookkeeper'),
        ('Submitted', 'Rejected by Bookkeeper', 'Bookkeeper'),

        # Treasurer transitions
        ('Verified by Bookkeeper', 'Pending Treasurer Review', 'Bookkeeper'),
        ('Pending Treasurer Review', 'Approved by Treasurer', 'Treasurer'),
        ('Pending Treasurer Review', 'Rejected by Treasurer', 'Treasurer'),
        ('Approved by Treasurer', 'Pending Credit Committee', 'Treasurer'),

        # Credit Committee transitions
        ('Pending Credit Committee', 'Approved by Credit Committee', 'Credit Committee'),
        ('Pending Credit Committee', 'Rejected by Credit Committee', 'Credit Committee'),
        ('Pending Credit Committee', 'Returned to Treasurer', 'Credit Committee'),

        # Admin/System transitions (for disbursement and completion)
        ('Approved by Credit Committee', 'Disbursed', 'Admin'),
        ('Disbursed', 'Paid', 'Admin'),
        ('Disbursed', 'Completed', 'Admin'),
    ]

    def handle(self, *args, **options):
        created_count = 0
        skipped_count = 0
        errors = []

        for from_status_name, to_status_name, role in self.TRANSITIONS:
            try:
                from_status = ApplicationStatus.objects.get(status_name=from_status_name)
            except ApplicationStatus.DoesNotExist:
                errors.append(f"Status '{from_status_name}' not found")
                continue

            try:
                to_status = ApplicationStatus.objects.get(status_name=to_status_name)
            except ApplicationStatus.DoesNotExist:
                errors.append(f"Status '{to_status_name}' not found")
                continue

            rule, created = StatusTransitionRule.objects.get_or_create(
                from_status=from_status,
                to_status=to_status,
                allowed_role=role
            )

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f"  Created: {from_status_name} -> {to_status_name} ({role})")
                )
            else:
                skipped_count += 1
                self.stdout.write(
                    self.style.WARNING(f"  Exists: {from_status_name} -> {to_status_name} ({role})")
                )

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f"Created {created_count} new transition rules"))
        self.stdout.write(f"Skipped {skipped_count} existing rules")

        if errors:
            self.stdout.write('')
            self.stdout.write(self.style.ERROR("Errors encountered:"))
            for error in errors:
                self.stdout.write(self.style.ERROR(f"  - {error}"))
            self.stdout.write('')
            self.stdout.write("Make sure all required statuses exist. Run:")
            self.stdout.write("  python manage.py shell")
            self.stdout.write("  from loans.models import ApplicationStatus")
            self.stdout.write("  ApplicationStatus.objects.values_list('status_name', flat=True)")
