"""
Management command to clean up duplicate verification records.
Run this if you encounter "get() returned more than one" errors.

Usage:
    python manage.py cleanup_duplicate_verifications
"""
from django.core.management.base import BaseCommand
from django.db.models import Count
from loans.models import FaceVerification, LivenessCheck


class Command(BaseCommand):
    help = 'Clean up duplicate Face Verification and Liveness Check records'

    def handle(self, *args, **options):
        self.stdout.write('Cleaning up duplicate verification records...\n')

        # Find applications with duplicate FaceVerifications
        face_duplicates = FaceVerification.objects.values('loan_application').annotate(
            count=Count('id')
        ).filter(count__gt=1)

        if face_duplicates.exists():
            self.stdout.write(f'Found {face_duplicates.count()} applications with duplicate FaceVerifications')

            for dup in face_duplicates:
                app_id = dup['loan_application']
                count = dup['count']

                # Keep only the most recent one
                records = FaceVerification.objects.filter(
                    loan_application_id=app_id
                ).order_by('-id')

                # Delete all except the first (most recent)
                to_delete = records[1:]
                deleted_count = len(to_delete)
                for record in to_delete:
                    record.delete()

                self.stdout.write(
                    self.style.SUCCESS(
                        f'  App {app_id}: Kept 1, deleted {deleted_count} duplicate(s)'
                    )
                )
        else:
            self.stdout.write(self.style.SUCCESS('No duplicate FaceVerifications found'))

        # Find applications with duplicate LivenessChecks
        liveness_duplicates = LivenessCheck.objects.values('loan_application').annotate(
            count=Count('id')
        ).filter(count__gt=1)

        if liveness_duplicates.exists():
            self.stdout.write(f'\nFound {liveness_duplicates.count()} applications with duplicate LivenessChecks')

            for dup in liveness_duplicates:
                app_id = dup['loan_application']
                count = dup['count']

                # Keep only the most recent one
                records = LivenessCheck.objects.filter(
                    loan_application_id=app_id
                ).order_by('-id')

                # Delete all except the first (most recent)
                to_delete = records[1:]
                deleted_count = len(to_delete)
                for record in to_delete:
                    record.delete()

                self.stdout.write(
                    self.style.SUCCESS(
                        f'  App {app_id}: Kept 1, deleted {deleted_count} duplicate(s)'
                    )
                )
        else:
            self.stdout.write(self.style.SUCCESS('No duplicate LivenessChecks found'))

        self.stdout.write(self.style.SUCCESS('\n✓ Cleanup complete!'))
