"""
Data migration to add required ApplicationStatus values for the loan workflow.

Design Decision:
- Creates all necessary status values for the complete loan workflow
- Uses get_or_create to avoid duplicates
- Reversible migration for safe rollback
"""

from django.db import migrations


def create_application_statuses(apps, schema_editor):
    """Create all required application statuses."""
    ApplicationStatus = apps.get_model('loans', 'ApplicationStatus')

    statuses = [
        'Submitted',
        'Verified by Bookkeeper',
        'Rejected by Bookkeeper',
        'Pending Treasurer Review',
        'Approved by Treasurer',
        'Rejected by Treasurer',
        'Pending Credit Committee',
        'Approved by Credit Committee',
        'Rejected by Credit Committee',
        'Approved',
        'Rejected',
        'Disbursed',
        'Completed',
        'Cancelled',
    ]

    for status_name in statuses:
        ApplicationStatus.objects.get_or_create(status_name=status_name)


def remove_application_statuses(apps, schema_editor):
    """Remove the created statuses (reverse migration)."""
    # Note: We don't actually remove statuses in reverse migration
    # as they might be in use by existing applications
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('bookkeeper', '0001_initial'),
        ('loans', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(create_application_statuses, remove_application_statuses),
    ]
